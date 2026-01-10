/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { PenLine, MousePointer } from 'lucide-react';
import { autoAssignPolarity, loadDesignatorCounters, saveDesignatorCounters, getDefaultPrefix, updateDesignatorCounter, isComponentPolarized, getNextDesignatorNumber } from './utils/components';
import { createComponentInstance } from './dataDrivenComponents/runtime/instanceFactory';
import {
  applyTransform,
  applySimpleTransform,
  applyViewTransform,
  addAngles,
  degToRad,
  angleFromVectorRaw,
  tan,
  TWO_PI,
  canvasDeltaToWorldDelta,
  applyInverseViewTransform,
  contentCanvasToWorld,
  darkenColor,
} from './utils/transformations';
import { 
  formatComponentTypeName,
  COLOR_PALETTE,
  COMPONENT_ICON,
} from './constants';
import { generatePointId, setPointIdCounter, getPointIdCounter, truncatePoint, registerAllocatedId, resetPointIdCounter, unregisterAllocatedId, generateUniqueId } from './utils/coordinates';
import { generateCenterCursor, generateTestPointCursor } from './utils/cursors';
import { formatTimestamp, removeTimestampFromFilename } from './utils/fileOperations';
import { migrateFromLegacyStorage, getCurrentService } from './utils/aiServices';
import { runTroubleshootingAnalysis, buildTroubleshootingPromptForPreview, extractTestPoints, type TroubleshootingPcbData } from './utils/troubleshooting';

// Migrate any legacy Gemini API key storage to new multi-service format
migrateFromLegacyStorage();
import { generateBOM, type BOMData } from './utils/bom';
import { createCloseProject, ensureProjectIsolation, type ProjectIsolationState } from './utils/projectOperations/projectIsolation';
import { createNewProject, openProject } from './utils/projectOperations/projectOperations';
import { performAutoSave as performAutoSaveModule, configureAutoSave } from './utils/projectOperations/autoSave';
import { isElectron, showDirectoryPicker as electronShowDirectoryPicker } from './utils/electronFileSystem';
// Project history imports available if needed: restoreFromHistory, listHistoryFiles, HistoryFile
import { generateHybridNetlist } from './utils/hybridNetlist';
import { type NodeOptionalFields, serializeNodeProperties, deserializeNodeProperties } from './utils/nodeProperties';
import jsPDF from 'jspdf';
import { createToolRegistry, getDefaultAbbreviation, saveToolSettings, saveToolLayerSettings } from './utils/toolRegistry';
import { toolInstanceManager, type ToolInstanceId } from './utils/toolInstances';
import type { ComponentType, PCBComponent, HomeView } from './types';
import { MenuBar } from './components/MenuBar';
import { WelcomeDialog } from './components/WelcomeDialog';
import { ErrorDialog } from './components/ErrorDialog';
import { DetailedInfoDialog } from './components/DetailedInfoDialog';
import { NotesDialog } from './components/NotesDialog';
import { ProjectNotesDialog, type ProjectNote } from './components/ProjectNotesDialog';
import { TroubleshootingDialog } from './components/TroubleshootingDialog';
import { NetNameSuggestionDialog } from './components/NetNameSuggestionDialog/NetNameSuggestionDialog';
import { TestPointsDialog } from './components/TestPointsDialog';
import { BoardDimensionsDialog, type BoardDimensions } from './components/BoardDimensionsDialog';
import { TransformImagesDialog } from './components/TransformImagesDialog';
import { TransformAllDialog } from './components/TransformAllDialog';
import { ComponentEditor } from './components/ComponentEditor';
import { ComponentSelectionDialog, type ComponentSelectionMetadata } from './components/ComponentSelectionDialog';
import { PowerBusManagerDialog } from './components/PowerBusManagerDialog';
import { GroundBusManagerDialog } from './components/GroundBusManagerDialog';
import { DesignatorManagerDialog } from './components/DesignatorManagerDialog';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { SetSizeDialog } from './components/SetSizeDialog';
import { AutoSaveDialog } from './components/AutoSaveDialog';
import { AutoSavePromptDialog } from './components/AutoSavePromptDialog';
import { PastMachineDialog } from './components/PastMachineDialog';
import { ICPlacementDialog } from './components/ICPlacementDialog';
import { resolveComponentDefinition } from './utils/componentDefinitionResolver';
import { generateICPlacementPads } from './utils/icPlacement';
import type { ComponentInput as ICComponentInput } from './types/icPlacement';
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
  useToolState,
  useLocks,
  useDialogs,
  useFileOperations,
  useUndo,
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
  const CONTENT_BORDER = 5;
  
  // ============================================================================
  // MEMORY MONITORING (Easy to disable - set to false to turn off)
  // ============================================================================
  // To disable memory monitoring, simply change this to false:
  const [showMemoryMonitor, setShowMemoryMonitor] = useState(false); // Hide by default
  const ENABLE_MEMORY_MONITOR = true; // Still keep monitoring logic available if needed
  // 
  // The memory monitor displays below the canvas, to the left of the x,y coordinates.
  // It shows: "Mem: X.XMB / YYYMB" (used memory / heap limit)
  // Updates every 1 minute automatically.
  // Note: Only works in Chrome/Edge (performance.memory API). Other browsers show "N/A".
  
  // Cache for keystone-warped images to prevent canvas element leaks
  // Key: `${imageName}-${keystoneV}-${keystoneH}-${srcW}-${srcH}`
  // Value: HTMLCanvasElement with the warped image
  const keystoneCacheRef = React.useRef<Map<string, HTMLCanvasElement>>(new Map()); // fixed border (in canvas pixels) where nothing is drawn
  
  // Tool instances are initialized at module load time (see toolInstances.ts)
  // Re-initialize from project data if needed (handled in loadProject)
  
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
    transparencyCycleSpeed,
    setTransparencyCycleSpeed,
    isGrayscale,
    setIsGrayscale,
  } = image;
  
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  
  // BOM Export format setting (default to 'pdf', persisted in localStorage)
  const [bomExportFormat, setBomExportFormat] = useState<'json' | 'pdf'>(() => {
    const saved = localStorage.getItem('bomExportFormat');
    return (saved === 'json' || saved === 'pdf') ? saved : 'pdf';
  });
  
  // Persist BOM export format to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem('bomExportFormat', bomExportFormat);
  }, [bomExportFormat]);
  
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
    viewRotation,
    setViewRotation,
    viewFlipX,
    setViewFlipX,
    cameraWorldCenter,
    setCameraWorldCenter,
    resetView,
    isShiftConstrained,
    setIsShiftConstrained,
    showBothLayers,
    setShowBothLayers,
    setCameraCenter,
    getViewPan,
  } = view;
  
  // Tool-specific layer defaults (persist until tool re-selected)
  // Initialize to null so radio buttons default to neither selected, forcing user to make a choice
  // Tool layer defaults - default to 'top' for new projects, persisted per tool
  const [traceToolLayer, setTraceToolLayer] = useState<'top' | 'bottom'>('top');
  const [padToolLayer, setPadToolLayer] = useState<'top' | 'bottom'>('top');
  const [testPointToolLayer, setTestPointToolLayer] = useState<'top' | 'bottom'>('top');
  const [componentToolLayer, setComponentToolLayer] = useState<'top' | 'bottom'>('top');
  
  // Refs to track current layer immediately (synchronously) for size/color updates
  // These are updated immediately when layer chooser buttons are clicked, before React state updates
  const traceToolLayerRef = React.useRef<'top' | 'bottom'>('top');
  const padToolLayerRef = React.useRef<'top' | 'bottom'>('top');
  const testPointToolLayerRef = React.useRef<'top' | 'bottom'>('top');
  const componentToolLayerRef = React.useRef<'top' | 'bottom'>('top');
  
  // Sync refs with state when state changes
  React.useEffect(() => {
    traceToolLayerRef.current = traceToolLayer;
  }, [traceToolLayer]);
  React.useEffect(() => {
    padToolLayerRef.current = padToolLayer;
  }, [padToolLayer]);
  React.useEffect(() => {
    testPointToolLayerRef.current = testPointToolLayer;
  }, [testPointToolLayer]);
  React.useEffect(() => {
    componentToolLayerRef.current = componentToolLayer;
  }, [componentToolLayer]);
  
  // Centralized tool state management - monitors toolbar actions and maintains active tool instance
  // This hook begins the tool state management decision process whenever a tool is selected:
  // Step 1: Which tool was selected? (monitored via currentTool, drawingMode)
  // Step 2: Which layer was selected? (monitored via traceToolLayer, padToolLayer, etc.)
  // Based on steps 1 and 2, the specific tool instance is determined and its attributes are used
  const toolStateManager = useToolState({
    currentTool,
    drawingMode,
    traceToolLayer,
    padToolLayer,
    testPointToolLayer,
    componentToolLayer,
  });
  const { toolState } = toolStateManager;
  
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
    topTestPointColor,
    bottomTestPointColor,
    topTestPointSize,
    bottomTestPointSize,
    topComponentColor,
    bottomComponentColor,
    topComponentSize,
    bottomComponentSize,
    traceToolLayer,
    padToolLayer,
    testPointToolLayer,
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
        } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
          // Use layer-specific test point colors
          const layer = testPointToolLayer || 'top';
          const testPointColor = layer === 'top' ? topTestPointColor : bottomTestPointColor;
          const testPointSize = layer === 'top' ? topTestPointSize : bottomTestPointSize;
          setBrushColor(testPointColor);
          setBrushSize(testPointSize);
          prevBrushColorRef.current = testPointColor;
          prevBrushSizeRef.current = testPointSize;
          // Update toolRegistry to reflect current layer's color and size, and sync all layer settings
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set('top', { color: topTestPointColor, size: topTestPointSize });
          layerSettings.set('bottom', { color: bottomTestPointColor, size: bottomTestPointSize });
          updated.set('testPoint', { 
            ...currentToolDef, 
            settings: { color: testPointColor, size: testPointSize },
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
  }, [currentTool, drawingMode, getCurrentToolDef, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topTestPointColor, bottomTestPointColor, topTestPointSize, bottomTestPointSize, testPointToolLayer, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize]); // Only depend on tool changes
  
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
    
    const testPointDef = toolRegistry.get('testPoint');
    if (testPointDef) {
      const topTestPoint = testPointDef.layerSettings.get('top');
      const bottomTestPoint = testPointDef.layerSettings.get('bottom');
      if (topTestPoint) {
        setTopTestPointColor(topTestPoint.color);
        setTopTestPointSize(topTestPoint.size);
      }
      if (bottomTestPoint) {
        setBottomTestPointColor(bottomTestPoint.color);
        setBottomTestPointSize(bottomTestPoint.size);
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
      
      // Sync test point layer settings
      const testPointDef = prev.get('testPoint');
      if (testPointDef) {
        const layerSettings = new Map(testPointDef.layerSettings);
        layerSettings.set('top', { color: topTestPointColor, size: topTestPointSize });
        layerSettings.set('bottom', { color: bottomTestPointColor, size: bottomTestPointSize });
        updated.set('testPoint', { ...testPointDef, layerSettings });
      }
      
      // Sync component layer settings
      const componentDef = prev.get('component');
      if (componentDef) {
        const layerSettings = new Map(componentDef.layerSettings);
        layerSettings.set('top', { color: topComponentColor, size: topComponentSize });
        layerSettings.set('bottom', { color: bottomComponentColor, size: bottomComponentSize });
        updated.set('component', { ...componentDef, layerSettings });
      }
      
      // Sync component connection settings
      const componentConnectionDef = prev.get('componentConnection');
      if (componentConnectionDef) {
        updated.set('componentConnection', {
          ...componentConnectionDef,
          settings: { color: componentConnectionColor, size: componentConnectionSize },
        });
      }
      
      return updated;
    });
  }, [topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topTestPointColor, bottomTestPointColor, topTestPointSize, bottomTestPointSize, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize, componentConnectionColor, componentConnectionSize, setToolRegistry]);
  
  // Update tool-specific settings when color/size changes (for the active tool)
  // This persists to localStorage and updates the registry
  // Also saves layer-specific defaults for trace, pad, and component tools
  React.useEffect(() => {
    setToolRegistry(prev => {
      const currentToolDef = getCurrentToolDef(prev);
      
      if (currentToolDef) {
        // Save to localStorage - use layer-specific settings for tools that support layers
        if (currentTool === 'draw' && drawingMode === 'trace') {
          // TRACE TOOL: use the trace tool instance as the single source of truth
          const layer = traceToolLayer || 'top';
          const traceInstanceId = layer === 'top' ? 'traceTop' : 'traceBottom';
          const traceInstance = toolInstanceManager.get(traceInstanceId);
          const color = traceInstance.color;
          const size = traceInstance.size;

          // Update project-level defaults from the instance
          if (layer === 'top') {
            setTopTraceColor(color);
            setTopTraceSize(size);
            saveDefaultColor('trace', color, 'top');
            saveDefaultSize('trace', size, 'top');
          } else {
            setBottomTraceColor(color);
            setBottomTraceSize(size);
            saveDefaultColor('trace', color, 'bottom');
            saveDefaultSize('trace', size, 'bottom');
          }
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color, size });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color, size }
          });
          prevBrushColorRef.current = color;
          prevBrushSizeRef.current = size;
          return updated;
        } else if (currentTool === 'draw' && drawingMode === 'pad') {
          // PAD TOOL: use the pad tool instance as the single source of truth
          const layer = padToolLayer || 'top';
          const padInstanceId = layer === 'top' ? 'padTop' : 'padBottom';
          const padInstance = toolInstanceManager.get(padInstanceId);
          const color = padInstance.color;
          const size = padInstance.size;

          if (layer === 'top') {
            setTopPadColor(color);
            setTopPadSize(size);
            saveDefaultColor('pad', color, 'top');
            saveDefaultSize('pad', size, 'top');
          } else {
            setBottomPadColor(color);
            setBottomPadSize(size);
            saveDefaultColor('pad', color, 'bottom');
            saveDefaultSize('pad', size, 'bottom');
          }
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color, size });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color, size }
          });
          prevBrushColorRef.current = color;
          prevBrushSizeRef.current = size;
          return updated;
        } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
          // TEST POINT TOOL: use the test point tool instance as the single source of truth
          const layer = testPointToolLayer || 'top';
          const testPointInstanceId = layer === 'top' ? 'testPointTop' : 'testPointBottom';
          const testPointInstance = toolInstanceManager.get(testPointInstanceId);
          const color = testPointInstance.color;
          const size = testPointInstance.size;

          if (layer === 'top') {
            setTopTestPointColor(color);
            setTopTestPointSize(size);
            saveDefaultColor('testPoint', color, 'top');
            saveDefaultSize('testPoint', size, 'top');
          } else {
            setBottomTestPointColor(color);
            setBottomTestPointSize(size);
            saveDefaultColor('testPoint', color, 'bottom');
            saveDefaultSize('testPoint', size, 'bottom');
          }
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color, size });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color, size }
          });
          prevBrushColorRef.current = color;
          prevBrushSizeRef.current = size;
          return updated;
        } else if (currentTool === 'component') {
          // COMPONENT TOOL: use the component tool instance as the single source of truth
          const layer = componentToolLayer || 'top';
          const componentInstanceId = layer === 'top' ? 'componentTop' : 'componentBottom';
          const componentInstance = toolInstanceManager.get(componentInstanceId);
          const color = componentInstance.color;
          const size = componentInstance.size;

          if (layer === 'top') {
            setTopComponentColor(color);
            setTopComponentSize(size);
            saveDefaultColor('component', color, 'top');
            saveDefaultSize('component', size, 'top');
          } else {
            setBottomComponentColor(color);
            setBottomComponentSize(size);
            saveDefaultColor('component', color, 'bottom');
            saveDefaultSize('component', size, 'bottom');
          }
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color, size });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color, size }
          });
          prevBrushColorRef.current = color;
          prevBrushSizeRef.current = size;
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
  }, [brushColor, brushSize, currentTool, drawingMode, traceToolLayer, padToolLayer, testPointToolLayer, componentToolLayer, getCurrentToolDef, saveDefaultColor, saveDefaultSize, saveToolLayerSettings, setTopTraceColor, setBottomTraceColor, setTopTraceSize, setBottomTraceSize, setTopPadColor, setBottomPadColor, setTopPadSize, setBottomPadSize, setTopTestPointColor, setBottomTestPointColor, setTopTestPointSize, setBottomTestPointSize, setTopComponentColor, setBottomComponentColor, setTopComponentSize, setBottomComponentSize]);
  // Apply trace tool layer default when trace tool is selected
  // Automatically turns on the layer visibility based on the current default
  React.useEffect(() => {
    if (currentTool === 'draw' && drawingMode === 'trace') {
      const layer = traceToolLayer; // Use current default (always 'top' or 'bottom', never null)
      setSelectedDrawingLayer(layer);
      setBrushColor(layer === 'top' ? topTraceColor : bottomTraceColor);
      setBrushSize(layer === 'top' ? topTraceSize : bottomTraceSize);
      // Automatically enable layer visibility
      if (layer === 'top') {
        setShowTopImage(true);
        setShowTopTracesLayer(true);
      } else {
        setShowBottomImage(true);
        setShowBottomTracesLayer(true);
      }
      // Show chooser to allow switching layers
      setShowTraceLayerChooser(true);
    } else {
      setShowTraceLayerChooser(false);
    }
  }, [currentTool, drawingMode, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize]);

  // Apply pad tool layer default when pad tool is selected
  // Automatically turns on the layer visibility based on the current default
  React.useEffect(() => {
    if (currentTool === 'draw' && drawingMode === 'pad') {
      const layer = padToolLayer; // Use current default (always 'top' or 'bottom', never null)
      setSelectedDrawingLayer(layer);
      const padInstance = toolInstanceManager.get(layer === 'top' ? 'padTop' : 'padBottom');
      setBrushColor(padInstance.color);
      setBrushSize(padInstance.size);
      // Automatically enable layer visibility
      if (layer === 'top') {
        setShowTopImage(true);
        setShowTopPadsLayer(true);
      } else {
        setShowBottomImage(true);
        setShowBottomPadsLayer(true);
      }
      // Show chooser to allow switching layers
      setShowPadLayerChooser(true);
    } else {
      setShowPadLayerChooser(false);
    }
  }, [currentTool, drawingMode, padToolLayer]);

  // Apply test point tool layer default when test point tool is selected
  // Automatically turns on the layer visibility based on the current default
  React.useEffect(() => {
    if (currentTool === 'draw' && drawingMode === 'testPoint') {
      const layer = testPointToolLayer; // Use current default (always 'top' or 'bottom', never null)
      setSelectedDrawingLayer(layer);
      setBrushColor(layer === 'top' ? topTestPointColor : bottomTestPointColor);
      setBrushSize(layer === 'top' ? topTestPointSize : bottomTestPointSize);
      // Automatically enable layer visibility
      if (layer === 'top') {
        setShowTopImage(true);
        setShowTopTestPointsLayer(true);
      } else {
        setShowBottomImage(true);
        setShowBottomTestPointsLayer(true);
      }
      // Show chooser to allow switching layers
      setShowTestPointLayerChooser(true);
    } else {
      setShowTestPointLayerChooser(false);
    }
  }, [currentTool, drawingMode, testPointToolLayer, topTestPointColor, bottomTestPointColor, topTestPointSize, bottomTestPointSize]);

  // Tracks whether the user has manually dismissed the component selection dialog
  // so it is not auto-reopened while the Component tool remains active.
  const [hasDismissedComponentDialog, setHasDismissedComponentDialog] = useState(false);
  const [hasDismissedSplash, setHasDismissedSplash] = useState(false);

  // Show component selection dialog when component tool is selected,
  // unless the user has manually dismissed it for the current tool session.
  React.useEffect(() => {
    if (currentTool === 'component') {
      const layer = componentToolLayer; // Use current default (always 'top' or 'bottom', never null)
      setSelectedDrawingLayer(layer);
      setBrushColor(layer === 'top' ? topComponentColor : bottomComponentColor);
      setBrushSize(layer === 'top' ? topComponentSize : bottomComponentSize);
      // Automatically enable layer visibility
      if (layer === 'top') {
        setShowTopImage(true);
        setShowTopComponents(true);
      } else {
        setShowBottomImage(true);
        setShowBottomComponents(true);
      }
      // Only auto-open if the user has not dismissed it while this tool is active
      if (!hasDismissedComponentDialog) {
      setShowComponentSelectionDialog(true);
      }
    } else {
      // When switching away from the component tool, hide the dialog
      // and reset the dismissal flag so it opens next time the tool is selected.
      setShowComponentSelectionDialog(false);
      setHasDismissedComponentDialog(false);
    }
  }, [currentTool, componentToolLayer, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize, hasDismissedComponentDialog]);
  
  // Update layer-specific settings when componentToolLayer changes
  React.useEffect(() => {
    if (currentTool === 'component') {
      const layer = componentToolLayer;
      setSelectedDrawingLayer(layer);
      setBrushColor(layer === 'top' ? topComponentColor : bottomComponentColor);
      setBrushSize(layer === 'top' ? topComponentSize : bottomComponentSize);
    }
  }, [componentToolLayer, currentTool, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize]);

  // Sync brushColor and brushSize with active tool instance (centralized state management)
  // This ensures brushColor/brushSize always reflect the current tool's attributes
  // This runs immediately when a tool is selected, beginning the tool state management process
  React.useEffect(() => {
    if (toolState.toolInstanceId) {
      // Tool state management decision process complete:
      // Step 1: Which tool was selected? ✓ (currentTool, drawingMode)
      // Step 2: Which layer was selected? ✓ (defaults to 'top' if not yet selected)
      // Result: Specific tool instance is known and its attributes are used
      setBrushColor(toolState.color);
      setBrushSize(toolState.size);
    }
  }, [toolState.toolInstanceId, toolState.color, toolState.size, setBrushColor, setBrushSize, currentTool, drawingMode]);
  
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
  
  // Calculate viewPan from cameraWorldCenter for drawing (backward compatibility)
  // Use useMemo to recalculate when canvas size or camera changes
  // Note: viewPan is in content area coordinates (after CONTENT_BORDER translate)
  const viewPan = React.useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    // Content area center in content area coordinates (after CONTENT_BORDER translate)
    const contentCenterX = (canvas.width - 2 * CONTENT_BORDER) / 2;
    const contentCenterY = (canvas.height - 2 * CONTENT_BORDER) / 2;
    return getViewPan(contentCenterX, contentCenterY);
  }, [canvasRef.current?.width, canvasRef.current?.height, cameraWorldCenter, viewScale, getViewPan]);
  
  // Helper function to set viewPan (converts from canvas coords to world coords for camera)
  // Note: viewPan is in content area coordinates (after CONTENT_BORDER translate)
  const setViewPan = React.useCallback((panOrUpdater: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Content area center in content area coordinates (after CONTENT_BORDER translate)
    const contentCenterX = (canvas.width - 2 * CONTENT_BORDER) / 2;
    const contentCenterY = (canvas.height - 2 * CONTENT_BORDER) / 2;
    
    // Get current viewPan value
    const currentViewPan = getViewPan(contentCenterX, contentCenterY);
    
    // Calculate new viewPan
    const newViewPan = typeof panOrUpdater === 'function' 
      ? panOrUpdater(currentViewPan)
      : panOrUpdater;
    
    // Convert viewPan (content area coords) to cameraWorldCenter (world coords)
    // Formula: cameraWorldCenter.x = (contentCenterX - viewPan.x) / viewScale
    const cameraWorldX = (contentCenterX - newViewPan.x) / viewScale;
    const cameraWorldY = (contentCenterY - newViewPan.y) / viewScale;
    
    setCameraWorldCenter({ x: cameraWorldX, y: cameraWorldY });
  }, [getViewPan, viewScale, setCameraWorldCenter]);
  
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
  
  // Undo hook
  const undoHook = useUndo();
  const { saveSnapshot, undo: performUndo, clearSnapshot } = undoHook;
  
  // Show power bus selector when power tool is selected (only if multiple buses exist)
  React.useEffect(() => {
    if (currentTool === 'power') {
      // Always close ground selector when power tool is selected
      setShowGroundBusSelector(false);
      if (powerBuses.length > 1) {
        // Multiple buses: show selector only if no bus is currently selected or selected bus is invalid
        const selectedBusExists = selectedPowerBusId && powerBuses.some(b => b.id === selectedPowerBusId);
        if (!selectedBusExists) {
          setShowPowerBusSelector(true);
          // Only clear selection if it's invalid, not if it's just unset
          if (selectedPowerBusId !== null) {
            setSelectedPowerBusId(null);
          }
        } else {
          // Valid bus is already selected, don't show selector
          setShowPowerBusSelector(false);
        }
      } else if (powerBuses.length === 1) {
        // Single bus: auto-select it and don't show selector
        setSelectedPowerBusId(powerBuses[0].id);
        setShowPowerBusSelector(false);
      } else {
        // No buses: show selector (user needs to create one)
        setShowPowerBusSelector(true);
        setSelectedPowerBusId(null);
      }
    } else {
      // Close power selector when switching to any other tool
      setShowPowerBusSelector(false);
      // Don't reset selectedPowerBusId when switching away - keep it for next time
    }
  }, [currentTool, powerBuses]);
  
  // Show ground bus selector when ground tool is selected (only if multiple buses exist)
  React.useEffect(() => {
    if (currentTool === 'ground') {
      // Always close power selector when ground tool is selected
      setShowPowerBusSelector(false);
      if (groundBuses.length > 1) {
        // Multiple buses: show selector only if no bus is currently selected or selected bus is invalid
        const selectedBusExists = selectedGroundBusId && groundBuses.some(b => b.id === selectedGroundBusId);
        if (!selectedBusExists) {
          setShowGroundBusSelector(true);
          // Only clear selection if it's invalid, not if it's just unset
          if (selectedGroundBusId !== null) {
            setSelectedGroundBusId(null);
          }
        } else {
          // Valid bus is already selected, don't show selector
          setShowGroundBusSelector(false);
        }
      } else if (groundBuses.length === 1) {
        // Single bus: auto-select it and don't show selector
        setSelectedGroundBusId(groundBuses[0].id);
        setShowGroundBusSelector(false);
      } else {
        // No buses: show selector (user needs to create one)
        setShowGroundBusSelector(true);
        setSelectedGroundBusId(null);
      }
    } else {
      // Close ground selector when switching to any other tool
      setShowGroundBusSelector(false);
      // Don't reset selectedGroundBusId when switching away - keep it for next time
    }
  }, [currentTool, groundBuses]);
  
  // Close both bus selectors when switching to any tool other than power or ground
  React.useEffect(() => {
    if (currentTool !== 'power' && currentTool !== 'ground') {
      setShowPowerBusSelector(false);
      setShowGroundBusSelector(false);
    }
  }, [currentTool]);
  
  // Locks hook
  const locks = useLocks();
  const {
    areImagesLocked,
    setAreImagesLocked,
    areViasLocked,
    setAreViasLocked,
    arePadsLocked,
    setArePadsLocked,
    areTestPointsLocked,
    setAreTestPointsLocked,
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
    // openProjectDialog, // Available but not currently used
    setOpenProjectDialog,
    newProjectSetupDialog,
    setNewProjectSetupDialog,
    saveAsDialog,
    setSaveAsDialog,
    showColorPicker,
    setShowColorPicker,
    // showWelcomeDialog and setShowWelcomeDialog are available but not currently used
    // showWelcomeDialog,
    // setShowWelcomeDialog,
    transformImagesDialogVisible,
    setTransformImagesDialogVisible,
  } = dialogs;
  
  // File operations hook
  const fileOperations = useFileOperations();
  
  // Save status indicator state: true = changes detected (yellow if auto-save enabled, red if disabled), false = saved (green)
  const [hasUnsavedChangesState, setHasUnsavedChangesState] = useState(false);
  
  // Transform All dialog state
  const [transformAllDialogVisible, setTransformAllDialogVisible] = useState(false);
  const [isBottomView, setIsBottomView] = useState(false);
  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; y: number } | null>(null);
  
  // Memory monitoring state (only used if ENABLE_MEMORY_MONITOR is true)
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    timestamp: number;
  } | null>(null);
  const [originalTopFlipX, setOriginalTopFlipX] = useState<boolean | null>(null);
  const [originalBottomFlipX, setOriginalBottomFlipX] = useState<boolean | null>(null);
  const [originalTopFlipY, setOriginalTopFlipY] = useState<boolean | null>(null);
  const [originalBottomFlipY, setOriginalBottomFlipY] = useState<boolean | null>(null);
  
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
  
  // Refs to store latest auto save configuration (declared early so they're available for useCallback hooks)
  const autoSaveDirHandleRef = useRef(autoSaveDirHandle);
  const autoSaveBaseNameRef = useRef(autoSaveBaseName);
  const currentProjectFilePathRef = useRef(currentProjectFilePath);
  const autoSaveFileHistoryRef = useRef<string[]>([]);
  const currentFileIndexRef = useRef<number>(-1);
  const projectDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const isOpeningProjectRef = useRef<boolean>(false);
  
  // Update refs to match current state values
  React.useEffect(() => {
    autoSaveDirHandleRef.current = autoSaveDirHandle;
  }, [autoSaveDirHandle]);
  React.useEffect(() => {
    autoSaveBaseNameRef.current = autoSaveBaseName;
  }, [autoSaveBaseName]);
  React.useEffect(() => {
    currentProjectFilePathRef.current = currentProjectFilePath;
  }, [currentProjectFilePath]);
  React.useEffect(() => {
    autoSaveFileHistoryRef.current = autoSaveFileHistory;
  }, [autoSaveFileHistory]);
  React.useEffect(() => {
    currentFileIndexRef.current = currentFileIndex;
  }, [currentFileIndex]);
  React.useEffect(() => {
    // Only sync if we're not in the middle of opening a project
    if (!isOpeningProjectRef.current) {
      projectDirHandleRef.current = projectDirHandle;
    }
  }, [projectDirHandle]);
  
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);
  const performAutoSaveRef = useRef<(() => Promise<void>) | null>(null);
  const openProjectRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const transparencyCycleRafRef = useRef<number | null>(null);
  const transparencyCycleStartRef = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ 
    startCX: number; 
    startCY: number; 
    panX: number; 
    panY: number; 
    objectStartPositions?: {
      topImageX: number;
      topImageY: number;
      bottomImageX: number;
      bottomImageY: number;
      componentsTop?: Record<string, { x: number; y: number }>;
      componentsBottom?: Record<string, { x: number; y: number }>;
      powerSymbols?: Record<string, { x: number; y: number }>;
      groundSymbols?: Record<string, { x: number; y: number }>;
      drawingStrokes?: Array<{ points: Array<{ x: number; y: number }> }>;
      vias?: Array<{ x: number; y: number }>;
      pads?: Array<{ x: number; y: number }>;
    };
  } | null>(null);
  const panClientStartRef = useRef<{ 
    startClientX: number; 
    startClientY: number; 
    panX: number; 
    panY: number; 
    objectStartPositions?: {
      topImageX: number;
      topImageY: number;
      bottomImageX: number;
      bottomImageY: number;
      componentsTop?: Record<string, { x: number; y: number }>;
      componentsBottom?: Record<string, { x: number; y: number }>;
      powerSymbols?: Record<string, { x: number; y: number }>;
      groundSymbols?: Record<string, { x: number; y: number }>;
      drawingStrokes?: Array<{ points: Array<{ x: number; y: number }> }>;
      vias?: Array<{ x: number; y: number }>;
      pads?: Array<{ x: number; y: number }>;
    };
  } | null>(null);
  // Component movement is now handled via keyboard arrow keys
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  // Home Views feature: allows user to set up to 10 custom view locations (0-9) that can be recalled
  const [homeViews, setHomeViews] = useState<Record<number, HomeView>>({});
  // Track when center tool is waiting for a number key press (with 2-second timeout)
  const [isWaitingForHomeViewKey, setIsWaitingForHomeViewKey] = useState(false);
  
  // Calculate default view 0: origin (0,0) with photos fully contained within canvas
  const calculateDefaultView0 = useCallback((): HomeView | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    // Get canvas content area (excluding border)
    const contentWidth = canvas.width - 2 * CONTENT_BORDER;
    const contentHeight = canvas.height - 2 * CONTENT_BORDER;
    
    // Find bounding box of all images
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasImages = false;
    
    if (topImage) {
      const img = topImage;
      const halfW = (img.width || 0) / 2;
      const halfH = (img.height || 0) / 2;
      minX = Math.min(minX, img.x - halfW);
      minY = Math.min(minY, img.y - halfH);
      maxX = Math.max(maxX, img.x + halfW);
      maxY = Math.max(maxY, img.y + halfH);
      hasImages = true;
    }
    
    if (bottomImage) {
      const img = bottomImage;
      const halfW = (img.width || 0) / 2;
      const halfH = (img.height || 0) / 2;
      minX = Math.min(minX, img.x - halfW);
      minY = Math.min(minY, img.y - halfH);
      maxX = Math.max(maxX, img.x + halfW);
      maxY = Math.max(maxY, img.y + halfH);
      hasImages = true;
    }
    
    if (!hasImages) {
      // No images - use default view
      return {
        pcbReferenceX: 0,
        pcbReferenceY: 0,
        cameraWorldCenterX: 0,
        cameraWorldCenterY: 0,
        x: 0,
        y: 0,
        zoom: 1,
        viewRotation: 0,
        viewFlipX: false,
        isBottomView: false,
        transparency: 0,
        showTopImage: true,
        showBottomImage: true,
        showViasLayer: true,
        showTopTracesLayer: true,
        showBottomTracesLayer: true,
        showTopPadsLayer: true,
        showBottomPadsLayer: true,
        showTopTestPointsLayer: true,
        showBottomTestPointsLayer: true,
        showTopComponents: true,
        showBottomComponents: true,
        showPowerLayer: true,
        showGroundLayer: true,
        showConnectionsLayer: true,
      };
    }
    
    // Calculate bounding box dimensions
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    
    // Add padding (10% margin on each side)
    const padding = 0.1;
    const paddedWidth = bboxWidth * (1 + 2 * padding);
    const paddedHeight = bboxHeight * (1 + 2 * padding);
    
    // Calculate scale to fit within canvas content area
    const scaleX = paddedWidth > 0 ? contentWidth / paddedWidth : 1;
    const scaleY = paddedHeight > 0 ? contentHeight / paddedHeight : 1;
    const zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x
    
    // For view 0, we want origin (0,0) to be at the center of the canvas
    // The PCB reference should be at (0,0) for the origin view
    return {
      pcbReferenceX: 0,
      pcbReferenceY: 0,
      cameraWorldCenterX: 0,
      cameraWorldCenterY: 0,
      x: 0,
      y: 0,
      zoom,
      viewRotation: 0,
      viewFlipX: false,
      isBottomView: false,
      transparency: 0,
      showTopImage: true,
      showBottomImage: true,
      showViasLayer: true,
      showTopTracesLayer: true,
      showBottomTracesLayer: true,
      showTopPadsLayer: true,
      showBottomPadsLayer: true,
      showTopTestPointsLayer: true,
      showBottomTestPointsLayer: true,
      showTopComponents: true,
      showBottomComponents: true,
      showPowerLayer: true,
      showGroundLayer: true,
      showConnectionsLayer: true,
    };
  }, [topImage, bottomImage]);
  
  // Initialize default view 0 when images are loaded or changed
  React.useEffect(() => {
    const defaultView0 = calculateDefaultView0();
    if (defaultView0) {
      setHomeViews(prev => {
        // Only set if view 0 doesn't exist yet (don't overwrite user's saved view 0)
        if (!prev[0]) {
          return { ...prev, 0: defaultView0 };
        }
        return prev;
      });
    }
  }, [topImage, bottomImage, calculateDefaultView0]);
  const homeViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOptionPressed, setIsOptionPressed] = useState(false);
  const [hoverComponent, setHoverComponent] = useState<{ component: PCBComponent; layer: 'top' | 'bottom'; x: number; y: number } | null>(null);
  const [hoverTestPoint, setHoverTestPoint] = useState<{ stroke: DrawingStroke; x: number; y: number } | null>(null);
  
  // Debounce hover detection to prevent crashes with many connections (48+ pins) at high zoom
  // Store last hover state to avoid unnecessary updates
  const lastHoverStateRef = React.useRef<{
    type: 'component' | 'testPoint' | 'connection' | null;
    componentId?: string;
    testPointId?: string;
    connectionKey?: string; // componentId + nodeId
  } | null>(null);
  const hoverDebounceTimeoutRef = React.useRef<number | null>(null);
  
  // Memoized tooltip content cache to prevent expensive re-renders
  const tooltipCacheRef = React.useRef<{
    componentId: string;
    content: React.ReactNode;
  } | null>(null);
  
  // Connection hover state for displaying pin info on rollover (when Option key is held)
  const [hoverConnection, setHoverConnection] = useState<{
    component: PCBComponent;
    layer: 'top' | 'bottom';
    pinIndices: number[]; // Pin indices that connect to this node
    nodeId: string;
    x: number; // Mouse X for tooltip positioning
    y: number; // Mouse Y for tooltip positioning
    stroke?: DrawingStroke; // The via/pad stroke for accessing notes
  } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 960, height: 600 });
  // Dialog and file operation states are now managed by useDialogs and useFileOperations hooks (see above)
  const newProjectYesButtonRef = useRef<HTMLButtonElement>(null);
  // const openProjectYesButtonRef = useRef<HTMLButtonElement>(null); // Available but not currently used
  const newProjectNameInputRef = useRef<HTMLInputElement>(null);
  const saveAsFilenameInputRef = useRef<HTMLInputElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const topThumbRef = useRef<HTMLCanvasElement>(null);
  const bottomThumbRef = useRef<HTMLCanvasElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  // Layer visibility toggles
  const [showTopImage, setShowTopImage] = useState(true);
  const [showBottomImage, setShowBottomImage] = useState(true);
  const [showAiSettingsDialog, setShowAiSettingsDialog] = useState(false);
  
  // Change Size/Color dialog states
  const [changeSizeDialog, setChangeSizeDialog] = useState<{ visible: boolean; size: number }>({ visible: false, size: 10 });
  const [changeColorDialog, setChangeColorDialog] = useState<{ visible: boolean; color: string }>({ visible: false, color: '#ff0000' });
  
  const [showViasLayer, setShowViasLayer] = useState(true);
  const [showTopTracesLayer, setShowTopTracesLayer] = useState(true);
  const [showBottomTracesLayer, setShowBottomTracesLayer] = useState(true);
  const [showTopPadsLayer, setShowTopPadsLayer] = useState(true);
  const [showBottomPadsLayer, setShowBottomPadsLayer] = useState(true);
  const [showTopTestPointsLayer, setShowTopTestPointsLayer] = useState(true);
  const [showBottomTestPointsLayer, setShowBottomTestPointsLayer] = useState(true);
  const [showTopComponents, setShowTopComponents] = useState(true);
  const [showBottomComponents, setShowBottomComponents] = useState(true);
  // Power layer
  const [showPowerLayer, setShowPowerLayer] = useState(true);
  // Power and ground symbols are now managed by usePowerGround hook (see above)
  // Use powerSymbols, groundSymbols, and powerBuses from the hook
  const powers = powerSymbols;
  const grounds = groundSymbols;
  const [showPowerBusManager, setShowPowerBusManager] = useState(false);
  const [editingPowerBusId, setEditingPowerBusId] = useState<string | null>(null);
  const [showPastMachine, setShowPastMachine] = useState(false);
  const [pastMachinePosition, setPastMachinePosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const [isDraggingPastMachine, setIsDraggingPastMachine] = useState(false);
  const [showPowerBusSelector, setShowPowerBusSelector] = useState(false);
  const [selectedPowerBusId, setSelectedPowerBusId] = useState<string | null>(null);
  // Component connection selection: Set of "componentId:pointId" strings
  const [selectedComponentConnections, setSelectedComponentConnections] = useState<Set<string>>(new Set());

  // Helper function to clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setSelectedComponentConnections(new Set());
  }, [setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds, setSelectedComponentConnections]);
  // Ground bus management (similar to power buses)
  const [showGroundBusManager, setShowGroundBusManager] = useState(false);
  const [editingGroundBusId, setEditingGroundBusId] = useState<string | null>(null);
  const [showGroundBusSelector, setShowGroundBusSelector] = useState(false);
  const [selectedGroundBusId, setSelectedGroundBusId] = useState<string | null>(null);
  // Designator management
  // Default to true for new projects - value is loaded from project file when opening existing projects
  const [autoAssignDesignators, setAutoAssignDesignators] = useState<boolean>(true);
  const [useGlobalDesignatorCounters, setUseGlobalDesignatorCounters] = useState<boolean>(false); // Default to OFF (project-local)
  const [showDesignatorManager, setShowDesignatorManager] = useState(false);
  // Session-level counters for project-local mode (tracks designators created in this session)
  const sessionDesignatorCountersRef = useRef<Record<string, number>>({});
  // Ground layer
  const [showGroundLayer, setShowGroundLayer] = useState(true);
  // Connections layer
  const [showConnectionsLayer, setShowConnectionsLayer] = useState(true);
  // Trace corner dots (circles at each vertex/turn)
  const [showTraceCornerDots, setShowTraceCornerDots] = useState(false);
  // Trace end dots (circles at start and end of traces)
  const [showTraceEndDots, setShowTraceEndDots] = useState(true);
  const [showCrosshairs, setShowCrosshairs] = useState(false);
  // Detailed Info Dialog position and drag state
  const [detailedInfoDialogPosition, setDetailedInfoDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDetailedInfoDialog, setIsDraggingDetailedInfoDialog] = useState(false);
  const [detailedInfoDialogDragOffset, setDetailedInfoDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // Notes Dialog state
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [notesDialogPosition, setNotesDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingNotesDialog, setIsDraggingNotesDialog] = useState(false);
  const [notesDialogDragOffset, setNotesDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // Project Notes
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
  const [projectMetadata, setProjectMetadata] = useState<{ productName: string; modelNumber: string; manufacturer: string; dateManufactured: string }>({
    productName: '',
    modelNumber: '',
    manufacturer: '',
    dateManufactured: new Date().toISOString().split('T')[0], // Auto-fill with current date (YYYY-MM-DD)
  });
  const [projectNotesDialogVisible, setProjectNotesDialogVisible] = useState(false);
  const [projectNotesDialogPosition, setProjectNotesDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingProjectNotesDialog, setIsDraggingProjectNotesDialog] = useState(false);
  const [projectNotesDialogDragOffset, setProjectNotesDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // Troubleshooting
  const [troubleshootingResults, setTroubleshootingResults] = useState<string | null>(null);
  const [troubleshootingDialogVisible, setTroubleshootingDialogVisible] = useState(false);
  const [troubleshootingDialogPosition, setTroubleshootingDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingTroubleshootingDialog, setIsDraggingTroubleshootingDialog] = useState(false);
  const [troubleshootingDialogDragOffset, setTroubleshootingDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  
  // Net Name Suggestion Dialog state
  const [netNameSuggestionDialogVisible, setNetNameSuggestionDialogVisible] = useState(false);
  const [netNameSuggestionDialogPosition, setNetNameSuggestionDialogPosition] = useState({ x: 150, y: 150 });
  const [isDraggingNetNameSuggestionDialog, setIsDraggingNetNameSuggestionDialog] = useState(false);
  const [netNameSuggestionDialogDragOffset, setNetNameSuggestionDialogDragOffset] = useState({ x: 0, y: 0 });
  const [pendingNetlistContent, setPendingNetlistContent] = useState<string | null>(null);
  const [netNameSuggestions, setNetNameSuggestions] = useState<Array<{
    original_name: string;
    suggested_name: string;
    confidence: number;
    reasoning: string;
  }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [includePcbData, setIncludePcbData] = useState(false);
  // Node Properties (optional fields for hybrid netlist)
  const [nodeProperties, setNodeProperties] = useState<Map<number, NodeOptionalFields>>(new Map());
  // Test Points Dialog
  const [testPointsDialogVisible, setTestPointsDialogVisible] = useState(false);
  const [testPointsDialogPosition, setTestPointsDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingTestPointsDialog, setIsDraggingTestPointsDialog] = useState(false);
  const [testPointsDialogDragOffset, setTestPointsDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // IC Placement Dialog
  const [showICPlacementDialog, setShowICPlacementDialog] = useState(false);
  const [icPlacementIsPad, setICPlacementIsPad] = useState(false);
  const [flashObjectId, setFlashObjectId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const [icPlacementOptions, setICPlacementOptions] = useState<ICComponentInput | null>(null);
  const [isICPlacementMode, setIsICPlacementMode] = useState(false);
  const [icPlacementArea, setICPlacementArea] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [isDrawingICPlacement, setIsDrawingICPlacement] = useState(false);
  const icPlacementOptionsRef = useRef<ICComponentInput | null>(null);
  const isICPlacementModeRef = useRef(false);
  const icPlacementAreaRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const isDrawingICPlacementRef = useRef(false);
  const icPlacementIsPadRef = useRef(false);
  
  React.useEffect(() => {
    icPlacementOptionsRef.current = icPlacementOptions;
  }, [icPlacementOptions]);
  
  React.useEffect(() => {
    isICPlacementModeRef.current = isICPlacementMode;
  }, [isICPlacementMode]);
  
  React.useEffect(() => {
    icPlacementAreaRef.current = icPlacementArea;
  }, [icPlacementArea]);
  
  React.useEffect(() => {
    isDrawingICPlacementRef.current = isDrawingICPlacement;
  }, [isDrawingICPlacement]);
  
  React.useEffect(() => {
    icPlacementIsPadRef.current = icPlacementIsPad;
  }, [icPlacementIsPad]);
  // Board dimensions for coordinate scaling
  // Default to null for new projects - value is loaded from project file when opening existing projects
  const [boardDimensions, setBoardDimensions] = useState<BoardDimensions | null>(null);
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
  // 1. If via has no POWER or GROUND node at same Node ID → "Via"
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
    
    // No power or ground connection → Via
    return 'Via';
  }, [powers, grounds]);

  // Helper function to determine pad type based on Node ID connections (same logic as vias)
  // Rules:
  // 1. If pad has no POWER or GROUND node at same Node ID → "Pad"
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
    
    // No power or ground connection → Pad
    return 'Pad';
  }, [powers, grounds]);

  // Helper function to determine test point type based on Node ID connections (same logic as pads)
  // Rules:
  // 1. If test point has no POWER or GROUND node at same Node ID → "Test Point"
  // 2. If test point has POWER node at same Node ID → "Test Point (+5VDC Power Node)" etc.
  // 3. If test point has GROUND node at same Node ID → "Test Point (Ground)"
  const determineTestPointType = useCallback((nodeId: number, powerBuses: PowerBus[]): string => {
    // Check for power node at this Node ID
    const powerNode = powers.find(p => p.pointId === nodeId);
    if (powerNode) {
      const bus = powerBuses.find(b => b.id === powerNode.powerBusId);
      const powerType = bus ? bus.voltage : (powerNode.type || 'Power Node');
      return `Test Point (${powerType})`;
    }
    
    // Check for ground node at this Node ID
    const groundNode = grounds.find(g => g.pointId === nodeId);
    if (groundNode) {
      const groundType = groundNode.type || 'Ground';
      return `Test Point (${groundType})`;
    }
    
    // No power or ground connection → Test Point
    return 'Test Point';
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
    setSelectedComponentConnections(new Set());
  }, [drawingStrokes, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectAllTraces = useCallback(() => {
    const traceIds = drawingStrokes
      .filter(s => s.type === 'trace')
      .map(s => s.id);
    setSelectedIds(new Set(traceIds));
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setSelectedComponentConnections(new Set());
  }, [drawingStrokes, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectAllPads = useCallback(() => {
    const padIds = drawingStrokes
      .filter(s => s.type === 'pad')
      .map(s => s.id);
    setSelectedIds(new Set(padIds));
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setSelectedComponentConnections(new Set());
  }, [drawingStrokes, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectAllComponents = useCallback(() => {
    const componentIds = [...componentsTop, ...componentsBottom].map(c => c.id);
    setSelectedComponentIds(new Set(componentIds));
    setSelectedIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setSelectedComponentConnections(new Set());
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
    setSelectedComponentConnections(new Set());
    // Automatically open the Detailed Information dialog
    setDebugDialog({ visible: true, text: '' });
  }, [componentsTop, componentsBottom, setSelectedComponentIds, setSelectedIds, setSelectedPowerIds, setSelectedGroundIds, setDebugDialog]);

  const selectAllComponentConnections = useCallback(() => {
    // Collect all component connections: each line from component center to via/pad
    // Format: "componentId:pointId" for each connection
    const connectionKeys = new Set<string>();
    let totalConnections = 0;
    
    for (const comp of [...componentsTop, ...componentsBottom]) {
      const pinConnections = comp.pinConnections || [];
      for (const conn of pinConnections) {
        if (conn && conn.trim() !== '') {
          const pointId = parseInt(conn.trim(), 10);
          if (!isNaN(pointId) && pointId > 0) {
            // Create unique key for this connection: "componentId:pointId"
            const connectionKey = `${comp.id}:${pointId}`;
            connectionKeys.add(connectionKey);
            totalConnections++;
          }
        }
      }
    }

    console.log(`Component connections: ${totalConnections} connection lines found`);

    if (connectionKeys.size === 0) {
      console.log('No component connections found - components may not have pins connected');
      alert('No component connections found. Please connect component pins to vias or pads first.');
      return;
    }

    // Select all component connections (the lines themselves)
    setSelectedComponentConnections(connectionKeys);
    // Clear other selections
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    
    console.log(`Selected ${connectionKeys.size} component connection lines`);
  }, [componentsTop, componentsBottom, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  // Select all visible objects on the canvas (based on layer checkboxes)
  const selectAll = useCallback(() => {
    // Select drawing strokes based on visible layers
    const visibleStrokeIds = drawingStrokes
      .filter(s => {
        if (s.type === 'via') return showViasLayer;
        if (s.type === 'trace') return s.layer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
        if (s.type === 'pad') return s.layer === 'top' ? showTopPadsLayer : showBottomPadsLayer;
        if (s.type === 'testPoint') return s.layer === 'top' ? showTopTestPointsLayer : showBottomTestPointsLayer;
        return false;
      })
      .map(s => s.id);
    setSelectedIds(new Set(visibleStrokeIds));
    
    // Select components based on visible layers
    const visibleComponentIds: string[] = [];
    if (showTopComponents) {
      visibleComponentIds.push(...componentsTop.map(c => c.id));
    }
    if (showBottomComponents) {
      visibleComponentIds.push(...componentsBottom.map(c => c.id));
    }
    setSelectedComponentIds(new Set(visibleComponentIds));
    
    // Select power nodes if power layer is visible
    const visiblePowerIds = showPowerLayer ? powers.map(p => p.id) : [];
    setSelectedPowerIds(new Set(visiblePowerIds));
    
    // Select ground nodes if ground layer is visible
    const visibleGroundIds = showGroundLayer ? grounds.map(g => g.id) : [];
    setSelectedGroundIds(new Set(visibleGroundIds));
    
    // Select component connections if connections layer is visible
    const connectionKeys = new Set<string>();
    if (showConnectionsLayer) {
      const visibleComponents = [
        ...(showTopComponents ? componentsTop : []),
        ...(showBottomComponents ? componentsBottom : [])
      ];
      for (const comp of visibleComponents) {
        const pinConnections = comp.pinConnections || [];
        for (const conn of pinConnections) {
          if (conn && conn.trim() !== '') {
            const pointId = parseInt(conn.trim(), 10);
            if (!isNaN(pointId) && pointId > 0) {
              connectionKeys.add(`${comp.id}:${pointId}`);
            }
          }
        }
      }
    }
    setSelectedComponentConnections(connectionKeys);
    
    console.log(`Selected visible: ${visibleStrokeIds.length} strokes, ${visibleComponentIds.length} components, ${visiblePowerIds.length} power nodes, ${visibleGroundIds.length} ground nodes, ${connectionKeys.size} connections`);
  }, [drawingStrokes, componentsTop, componentsBottom, powers, grounds, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopPadsLayer, showBottomPadsLayer, showTopTestPointsLayer, showBottomTestPointsLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer, showConnectionsLayer, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  // Switch perspective (toggle between top and bottom view)
  // This now modifies the VIEW transform, not object properties
  // Objects maintain their world coordinates and properties unchanged
  const switchPerspective = useCallback(() => {
    if (isBottomView) {
      // Switch to Top View - remove view flip and show only top image
      setViewFlipX(false);
      setIsBottomView(false);
      setTransparency(0); // 0 = bottom image transparent, only top visible
    } else {
      // Switch to Bottom View - apply view flip and show only bottom image
      setViewFlipX(true);
      setIsBottomView(true);
      setTransparency(100); // 100 = bottom image fully opaque, only bottom visible
    }
  }, [isBottomView, setViewFlipX, setIsBottomView, setTransparency]);

  // Rotate perspective by specified angle (clockwise)
  // This now modifies the VIEW transform, not object properties
  // Objects maintain their world coordinates and properties unchanged
  const rotatePerspective = useCallback((angle: number) => {
    // When viewing from the bottom, the view is flipped horizontally (viewFlipX=true).
    // To keep rotation intuitive (clockwise = clockwise on screen), we must 
    // negate the world-space rotation angle when the view is flipped.
    const effectiveAngle = isBottomView ? -angle : angle;
    setViewRotation(prev => addAngles(prev, effectiveAngle));
  }, [setViewRotation, isBottomView]);

  // Generic function to center any object at given world coordinates
  const findAndCenterObject = useCallback((worldX: number, worldY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate visible center in canvas content coordinates
    const contentWidth = canvas.width - 2 * CONTENT_BORDER;
    const contentHeight = canvas.height - 2 * CONTENT_BORDER;
    const visibleCenterX = contentWidth / 2;
    const visibleCenterY = contentHeight / 2;

    // Calculate viewPan to center the object at the visible center
    // Formula: viewPan = visibleCenter - world * scale
    const newPanX = visibleCenterX - worldX * viewScale;
    const newPanY = visibleCenterY - worldY * viewScale;

    // Update view pan to center on object
    setViewPan({ x: newPanX, y: newPanY });
  }, [viewScale, setViewPan]);

  const findAndCenterObjectWithFlash = useCallback((id: string, worldX: number, worldY: number) => {
    findAndCenterObject(worldX, worldY);
    
    // Set flash object ID and clear after a delay
    setFlashObjectId(id);
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = setTimeout(() => {
      setFlashObjectId(null);
      flashTimeoutRef.current = null;
    }, 2000); // Flash for 2 seconds
  }, [findAndCenterObject]);

  const findAndCenterComponent = useCallback((componentId: string, worldX: number, worldY: number) => {
    findAndCenterObjectWithFlash(componentId, worldX, worldY);
  }, [findAndCenterObjectWithFlash]);

  const findAndCenterStroke = useCallback((strokeId: string, worldX: number, worldY: number) => {
    findAndCenterObjectWithFlash(strokeId, worldX, worldY);
  }, [findAndCenterObjectWithFlash]);

  const findAndCenterPower = useCallback((powerId: string, worldX: number, worldY: number) => {
    findAndCenterObjectWithFlash(powerId, worldX, worldY);
  }, [findAndCenterObjectWithFlash]);

  const findAndCenterGround = useCallback((groundId: string, worldX: number, worldY: number) => {
    findAndCenterObjectWithFlash(groundId, worldX, worldY);
  }, [findAndCenterObjectWithFlash]);

  const findAndCenterTestPoint = useCallback((strokeId: string, worldX: number, worldY: number) => {
    findAndCenterObjectWithFlash(strokeId, worldX, worldY);
  }, [findAndCenterObjectWithFlash]);

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
    setSelectedComponentConnections(new Set());
  }, [powers, setSelectedPowerIds, setSelectedIds, setSelectedComponentIds, setSelectedGroundIds]);

  const selectAllGroundNodes = useCallback(() => {
    const groundIds = grounds.map(g => g.id);
    setSelectedGroundIds(new Set(groundIds));
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedComponentConnections(new Set());
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

  // Utility function to get contextual value for a component (currently unused)
  // @ts-ignore - getComponentContextualValue is intentionally unused
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
      case 'Film Capacitor':
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

  // Get detailed component information for hover tooltip
  const getComponentDetails = useCallback((comp: PCBComponent): string[] => {
    const details: string[] = [];
    
    switch (comp.componentType) {
      case 'Capacitor':
      case 'Electrolytic Capacitor':
      case 'Film Capacitor':
        if ('capacitance' in comp && comp.capacitance && 'capacitanceUnit' in comp && comp.capacitanceUnit) {
          details.push(`Capacitance: ${comp.capacitance} ${comp.capacitanceUnit}`);
        }
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          details.push(`Voltage: ${comp.voltage} ${comp.voltageUnit}`);
        }
        if ('dielectric' in comp && comp.dielectric) {
          details.push(`Dielectric: ${comp.dielectric}`);
        }
        break;
        
      case 'Resistor':
      case 'ResistorNetwork':
      case 'Thermistor':
        if ('resistance' in comp && comp.resistance && 'resistanceUnit' in comp && comp.resistanceUnit) {
          details.push(`Resistance: ${comp.resistance} ${comp.resistanceUnit}`);
        }
        if ('power' in comp && comp.power) {
          details.push(`Power: ${comp.power}`);
        }
        if ('tolerance' in comp && comp.tolerance) {
          details.push(`Tolerance: ${comp.tolerance}`);
        }
        break;
        
      case 'VariableResistor':
        if ('resistance' in comp && comp.resistance && 'resistanceUnit' in comp && comp.resistanceUnit) {
          details.push(`Resistance: ${comp.resistance} ${comp.resistanceUnit}`);
        }
        if ('vrType' in comp && comp.vrType) {
          details.push(`Type: ${comp.vrType}`);
        }
        if ('power' in comp && comp.power) {
          details.push(`Power: ${comp.power}`);
        }
        if ('taper' in comp && comp.taper) {
          details.push(`Taper: ${comp.taper}`);
        }
        break;
        
      case 'Inductor':
        if ('inductance' in comp && comp.inductance && 'inductanceUnit' in comp && comp.inductanceUnit) {
          details.push(`Inductance: ${comp.inductance} ${comp.inductanceUnit}`);
        }
        if ('current' in comp && comp.current && 'currentUnit' in comp && comp.currentUnit) {
          details.push(`Current: ${comp.current} ${comp.currentUnit}`);
        }
        if ('tolerance' in comp && comp.tolerance) {
          details.push(`Tolerance: ${comp.tolerance}`);
        }
        break;
        
      case 'Battery':
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          details.push(`Voltage: ${comp.voltage} ${comp.voltageUnit}`);
        }
        if ('capacity' in comp && comp.capacity && 'capacityUnit' in comp && comp.capacityUnit) {
          details.push(`Capacity: ${comp.capacity} ${comp.capacityUnit}`);
        }
        break;
        
      case 'Diode':
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          details.push(`Voltage: ${comp.voltage} ${comp.voltageUnit}`);
        }
        if ('current' in comp && comp.current && 'currentUnit' in comp && comp.currentUnit) {
          details.push(`Current: ${comp.current} ${comp.currentUnit}`);
        }
        break;
        
      case 'Fuse':
        if ('current' in comp && comp.current && 'currentUnit' in comp && comp.currentUnit) {
          details.push(`Current: ${comp.current} ${comp.currentUnit}`);
        }
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          details.push(`Voltage: ${comp.voltage} ${comp.voltageUnit}`);
        }
        break;
        
      case 'FerriteBead':
        if ('impedance' in comp && comp.impedance && 'impedanceUnit' in comp && comp.impedanceUnit) {
          details.push(`Impedance: ${comp.impedance} ${comp.impedanceUnit}`);
        }
        if ('current' in comp && comp.current && 'currentUnit' in comp && comp.currentUnit) {
          details.push(`Current: ${comp.current} ${comp.currentUnit}`);
        }
        break;
        
      case 'Relay':
        if ('coilVoltage' in comp && comp.coilVoltage && 'coilVoltageUnit' in comp && comp.coilVoltageUnit) {
          details.push(`Coil Voltage: ${comp.coilVoltage} ${comp.coilVoltageUnit}`);
        }
        if ('contactRating' in comp && comp.contactRating) {
          details.push(`Contact Rating: ${comp.contactRating}`);
        }
        break;
        
      case 'Speaker':
        if ('impedance' in comp && comp.impedance && 'impedanceUnit' in comp && comp.impedanceUnit) {
          details.push(`Impedance: ${comp.impedance} ${comp.impedanceUnit}`);
        }
        if ('power' in comp && comp.power) {
          details.push(`Power: ${comp.power}`);
        }
        break;
        
      case 'Motor':
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          details.push(`Voltage: ${comp.voltage} ${comp.voltageUnit}`);
        }
        if ('speed' in comp && comp.speed && 'speedUnit' in comp && comp.speedUnit) {
          details.push(`Speed: ${comp.speed} ${comp.speedUnit}`);
        }
        break;
        
      case 'PowerSupply':
        if ('outputVoltage' in comp && comp.outputVoltage && 'outputVoltageUnit' in comp && comp.outputVoltageUnit) {
          details.push(`Output Voltage: ${comp.outputVoltage} ${comp.outputVoltageUnit}`);
        }
        if ('outputCurrent' in comp && comp.outputCurrent && 'outputCurrentUnit' in comp && comp.outputCurrentUnit) {
          details.push(`Output Current: ${comp.outputCurrent} ${comp.outputCurrentUnit}`);
        }
        break;
        
      case 'Transistor':
        if ('partNumber' in comp && comp.partNumber) {
          details.push(`Part Number: ${comp.partNumber}`);
        }
        if ('transistorType' in comp && comp.transistorType) {
          details.push(`Type: ${comp.transistorType}`);
        }
        break;
        
      case 'Crystal':
        if ('frequency' in comp && comp.frequency) {
          details.push(`Frequency: ${comp.frequency}`);
        }
        if ('loadCapacitance' in comp && comp.loadCapacitance) {
          details.push(`Load Capacitance: ${comp.loadCapacitance}`);
        }
        if ('tolerance' in comp && comp.tolerance) {
          details.push(`Tolerance: ${comp.tolerance}`);
        }
        break;
        
      case 'VacuumTube':
        if ('tubeType' in comp && comp.tubeType) {
          details.push(`Tube Type: ${comp.tubeType}`);
        }
        if ('partNumber' in comp && comp.partNumber) {
          details.push(`Part Number: ${comp.partNumber}`);
        }
        break;
    }
    
    return details;
  }, []);
  
  // Tool-specific layer defaults are now declared above (before useToolRegistry hook)
  // Show chooser popovers only when tool is (re)selected
  const [showTraceLayerChooser, setShowTraceLayerChooser] = useState(false);
  const traceChooserRef = useRef<HTMLDivElement>(null);
  // Pad layer chooser (like trace layer chooser)
  const [showPadLayerChooser, setShowPadLayerChooser] = useState(false);
  const [showTestPointLayerChooser, setShowTestPointLayerChooser] = useState(false);
  const padChooserRef = useRef<HTMLDivElement>(null);
  const testPointChooserRef = useRef<HTMLDivElement>(null);
  // Power Bus selector
  const powerBusSelectorRef = useRef<HTMLDivElement>(null);
  const groundBusSelectorRef = useRef<HTMLDivElement>(null);
  // Component selection dialog
  const [showComponentSelectionDialog, setShowComponentSelectionDialog] = useState(false);
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType | null>(null);
  const [selectedComponentKey, setSelectedComponentKey] = useState<string | null>(null);
  const [selectedComponentMetadata, setSelectedComponentMetadata] = useState<ComponentSelectionMetadata | null>(null);
  const lastSelectedComponentTypeRef = React.useRef<ComponentType | null>(null);
  // Refs to hold the latest values for event handlers (avoids stale closure issues)
  const selectedComponentMetadataRef = React.useRef<ComponentSelectionMetadata | null>(null);
  const selectedComponentTypeRef = React.useRef<ComponentType | null>(null);
  const traceButtonRef = useRef<HTMLButtonElement>(null);
  const padButtonRef = useRef<HTMLButtonElement>(null);
  const testPointButtonRef = useRef<HTMLButtonElement>(null);
  const componentButtonRef = useRef<HTMLButtonElement>(null);
  const powerButtonRef = useRef<HTMLButtonElement>(null);
  const groundButtonRef = useRef<HTMLButtonElement>(null);
  // Store pending component position (set by click, used when type is selected)
  const [pendingComponentPosition, setPendingComponentPosition] = useState<{ x: number; y: number; layer: 'top' | 'bottom' } | null>(null);
  
  // Copy/paste state for components
  const [copiedComponent, setCopiedComponent] = useState<PCBComponent | null>(null);
  
  const [isSnapDisabled, setIsSnapDisabled] = useState(false); // Control key disables snap-to
  // Selection state (selectedIds, isSelecting are now provided by useSelection hook - see above)
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [selectRect, setSelectRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // (Open Project uses native picker or hidden input; no overlay)

  // Sync refs for event handlers (avoids stale closure issues)
  // These refs ensure that event handlers always have access to the latest state values
  React.useEffect(() => {
    selectedComponentMetadataRef.current = selectedComponentMetadata;
  }, [selectedComponentMetadata]);
  React.useEffect(() => {
    selectedComponentTypeRef.current = selectedComponentType;
  }, [selectedComponentType]);

  // Helper function to clean up image resources (ImageBitmap and Object URL)
  // This prevents memory leaks by properly disposing of GPU memory and blob references
  const cleanupImageResources = useCallback((image: PCBImage | null) => {
    if (!image) return;
    
    // Close ImageBitmap to free GPU memory
    if (image.bitmap) {
      try {
        image.bitmap.close();
      } catch (err) {
        // ImageBitmap may already be closed, ignore errors
        console.warn('Error closing ImageBitmap:', err);
      }
    }
    
    // Revoke Object URL to free blob reference
    if (image.url && image.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(image.url);
      } catch (err) {
        // URL may already be revoked, ignore errors
        console.warn('Error revoking Object URL:', err);
      }
    }
  }, []);

  // Helper function to copy image file to images/ subdirectory in project directory
  const copyImageToProjectDirectory = useCallback(async (file: File, projectDirHandle: FileSystemDirectoryHandle | null): Promise<string> => {
    if (!projectDirHandle) {
      throw new Error('No project directory available. Please create or open a project before loading images. The project directory is needed to store image files.');
    }

    try {
      // Ensure images subdirectory exists (lowercase to match history/)
      let imagesDirHandle: FileSystemDirectoryHandle;
      try {
        imagesDirHandle = await projectDirHandle.getDirectoryHandle('images', { create: true });
      } catch (e) {
        throw new Error(`Failed to create images directory in project folder. This may be due to insufficient permissions. Please ensure you have write access to the project directory. Error details: ${(e as Error).message}`);
      }

      // Copy the file to images subdirectory (always copy, even if file exists)
      const fileName = file.name;
      const imagePath = `images/${fileName}`;
      
      try {
        const fileHandle = await imagesDirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        console.log(`Image copied to project directory: ${imagePath}`);
        return imagePath;
      } catch (e) {
        throw new Error(`Failed to copy image file "${fileName}" to project images directory. The file may be locked by another application, or there may be insufficient disk space. Please try again or check your disk space. Error details: ${(e as Error).message}`);
      }
    } catch (err) {
      // Re-throw with more context if it's already our error
      if (err instanceof Error && err.message.includes('No project directory')) {
        throw err;
      }
      if (err instanceof Error && err.message.includes('Failed to')) {
        throw err;
      }
      // Otherwise, wrap in a user-friendly error
      throw new Error(`An unexpected error occurred while copying the image to the project directory. This may be due to file system permissions or disk space issues. Please try again. Technical details: ${(err as Error).message}`);
    }
  }, []);

  const handleImageLoad = useCallback(async (file: File, type: 'top' | 'bottom') => {
    try {
      // Validate file type - only accept PNG and JPEG images
      const fileName = file.name.toLowerCase();
      const validExtensions = ['.png', '.jpg', '.jpeg'];
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      
      // Also check MIME type as a secondary validation
      const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      const hasValidMimeType = validMimeTypes.includes(file.type);
      
      if (!hasValidExtension && !hasValidMimeType) {
        alert(`Error: Unsupported image format.\n\nThe software only accepts PNG and JPEG image files.\n\nFile selected: ${file.name}\nFile type: ${file.type || 'unknown'}\n\nPlease select a .png, .jpg, or .jpeg image file.`);
        return;
      }

      // First, copy the image to the project directory if we have one
      let imageFilePath: string | undefined;
      if (projectDirHandle) {
        try {
          imageFilePath = await copyImageToProjectDirectory(file, projectDirHandle);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred while copying image to project directory.';
          alert(`Error: ${errorMessage}\n\nThe image could not be loaded. Please ensure you have a project open and have write permissions to the project directory.`);
          return;
        }
      } else {
        // No project directory yet - warn user but allow loading (they'll need to save project first)
        const layerName = type === 'top' ? 'top' : 'bottom';
        const proceed = confirm(`Warning: No project directory is currently open. The image will be loaded, but you must create or open a project and save it before the image will be stored in the project directory.\n\nDo you want to continue loading the ${layerName} image?`);
        if (!proceed) {
          return;
        }
        // Use just the filename for now - will be updated when project is saved
        imageFilePath = file.name;
      }

      // Clean up old image resources before loading new one
      if (type === 'top' && topImage) {
        cleanupImageResources(topImage);
        // Clear keystone cache for top image
        const keysToDelete: string[] = [];
        keystoneCacheRef.current.forEach((_, key) => {
          if (key.startsWith('top-')) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => keystoneCacheRef.current.delete(key));
      } else if (type === 'bottom' && bottomImage) {
        cleanupImageResources(bottomImage);
        // Clear keystone cache for bottom image
        const keysToDelete: string[] = [];
        keystoneCacheRef.current.forEach((_, key) => {
          if (key.startsWith('bottom-')) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => keystoneCacheRef.current.delete(key));
      }
      
      // Note: Filter cache is cleared automatically when images change
      // (handled by clearFilterCache in canvas.ts when needed)

      const bitmap = await createImageBitmap(file);
      const url = URL.createObjectURL(file);
      
      // Calculate initial world position for image center
      // Images should start centered, which in world coordinates is:
      // worldX = (centerX - viewPan.x) / viewScale
      // For initial load, viewPan is typically set to center the view, so world position is approximately 0
      // But to be precise, we'll calculate it based on current canvas and view state
      const canvas = canvasRef.current;
      let initialWorldX = 0;
      let initialWorldY = 0;
      if (canvas) {
        // Use current camera center as initial world position
        initialWorldX = cameraWorldCenter.x;
        initialWorldY = cameraWorldCenter.y;
      }
      
      const imageData: PCBImage = {
        url,
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
        // No dataUrl - images are stored as files in images/ subdirectory
        filePath: imageFilePath, // Path relative to project directory (e.g., "images/filename.jpg")
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred while loading the image.';
      alert(`Error: Failed to load image file "${file.name}".\n\n${errorMessage}\n\nPlease ensure the file is a valid image format (PNG, JPEG, etc.) and is not corrupted.`);
      console.error('Failed to load image', err);
    }
  }, [cameraWorldCenter, viewScale, projectDirHandle, copyImageToProjectDirectory]);

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
    // Convert to world coordinates accounting for view rotation and flip
    const worldPos = contentCanvasToWorld(contentCanvasX, contentCanvasY, viewPan, viewScale, viewRotation, viewFlipX);
    const x = worldPos.x;
    const y = worldPos.y;

    // IC Placement mode: start drawing rectangle
    if (isICPlacementModeRef.current && currentTool === 'select') {
      setIsDrawingICPlacement(true);
      setICPlacementArea({ start: { x, y }, end: { x, y } });
      return;
    }

    // Handle setting home view location - when center tool is active and user clicks,
    // start waiting for a number key (0-9) to assign this view to that slot
    if (currentTool === 'center') {
      // Start waiting for number key with 2-second timeout
      setIsWaitingForHomeViewKey(true);
      // Clear any existing timeout
      if (homeViewTimeoutRef.current) {
        clearTimeout(homeViewTimeoutRef.current);
      }
      // Set 2-second timeout to return to select tool if no number is pressed
      homeViewTimeoutRef.current = setTimeout(() => {
        setIsWaitingForHomeViewKey(false);
      setCurrentTool('select');
        setCanvasCursor(undefined);
      }, 2000);
      return;
    }

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
          // Shift-click: add to selection (toggle) - preserve other selections
          // Use functional update to ensure we work with latest state
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
          // Shift-click: toggle selection - preserve other selections
          // Use functional update to ensure we work with latest state
          setSelectedPowerIds(prev => {
            const next = new Set(prev);
            if (next.has(hitPower.id)) {
              next.delete(hitPower.id);
            } else {
              next.add(hitPower.id);
            }
            return next;
          });
          // Keep other selections when Shift-clicking
        } else {
          // Regular click: select only this power node
          setSelectedPowerIds(new Set([hitPower.id]));
          // Clear other selections
          setSelectedIds(new Set());
          setSelectedComponentIds(new Set());
          setSelectedGroundIds(new Set());
        }
        
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
        if (e.shiftKey) {
          // Shift-click: add to selection (toggle) - preserve other selections
          // Use functional update to ensure we work with latest state
          setSelectedGroundIds(prev => {
            const next = new Set(prev);
            if (next.has(hitGround.id)) {
              next.delete(hitGround.id);
            } else {
              next.add(hitGround.id);
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
        if ((s.type === 'via' || s.type === 'pad' || s.type === 'testPoint') && s.points.length > 0) {
          // Check visibility based on type and layer
          let isVisible = false;
          if (s.type === 'via') {
            isVisible = showViasLayer;
          } else if (s.type === 'pad') {
            // Pads have layer-specific visibility
            const padLayer = s.layer || 'top';
            isVisible = padLayer === 'top' ? showTopPadsLayer : showBottomPadsLayer;
          } else if (s.type === 'testPoint') {
            // Test points have layer-specific visibility
            const testPointLayer = s.layer || 'top';
            isVisible = testPointLayer === 'top' ? showTopTestPointsLayer : showBottomTestPointsLayer;
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
        
        if (e.shiftKey) {
          // Shift-click: toggle selection - preserve other selections
          // Use functional update to ensure we work with latest state
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(hitStroke.id)) {
              next.delete(hitStroke.id);
            } else {
              next.add(hitStroke.id);
            }
            return next;
          });
          // Keep other selections when Shift-clicking
        } else {
          // Regular click: select only this via/pad
          setSelectedIds(new Set([hitStroke.id]));
          // Clear other selections
          setSelectedComponentIds(new Set());
          setSelectedPowerIds(new Set());
          setSelectedGroundIds(new Set());
          setSelectedComponentConnections(new Set());
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
        setSelectedComponentConnections(new Set());
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
      // Keep clicked world point under cursor after zoom: center camera on that world point
      setCameraCenter(x, y);
      setViewScale(newScale);
      return;
    } else if (currentTool === 'pan') {
      // Start panning - track starting positions of all objects in world coordinates
      // Store object positions so we can translate them while keeping origin fixed
      const objectStartPositions = {
        topImageX: topImage?.x ?? 0,
        topImageY: topImage?.y ?? 0,
        bottomImageX: bottomImage?.x ?? 0,
        bottomImageY: bottomImage?.y ?? 0,
        componentsTop: Object.fromEntries(componentsTop.map(c => [c.id, { x: c.x, y: c.y }])),
        componentsBottom: Object.fromEntries(componentsBottom.map(c => [c.id, { x: c.x, y: c.y }])),
        powerSymbols: Object.fromEntries(powerSymbols.map(p => [p.id, { x: p.x, y: p.y }])),
        groundSymbols: Object.fromEntries(groundSymbols.map(g => [g.id, { x: g.x, y: g.y }])),
        drawingStrokes: drawingStrokes.map(stroke => ({
          points: stroke.points.map(p => ({ x: p.x, y: p.y }))
        })),
        vias: vias.map(v => ({ x: v.x, y: v.y })),
        pads: pads.map(p => ({ x: p.x, y: p.y }))
      };
      
      panStartRef.current = { 
        startCX: contentCanvasX, 
        startCY: contentCanvasY, 
        panX: viewPan.x, 
        panY: viewPan.y,
        objectStartPositions,
      };
      // Also track client coordinates for out-of-canvas drags
      panClientStartRef.current = { 
        startClientX: e.clientX, 
        startClientY: e.clientY, 
        panX: viewPan.x, 
        panY: viewPan.y,
        objectStartPositions,
      };
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
        // Use tool instance directly (single source of truth) to match toolbar and cursor colors
        const viaInstance = toolInstanceManager.get('via');
        const viaColor = viaInstance.color;
        const viaSize = viaInstance.size;
        
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
        // Save snapshot before adding new via
        saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
        
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
            if (s.type === 'via' || s.type === 'pad' || s.type === 'testPoint') {
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
        // Save snapshot before adding new pad
        saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
        
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

      if (drawingMode === 'testPoint') {
        // Only place test point if a layer has been selected (like component tool)
        if (!testPointToolLayer) {
          return; // Wait for user to select a layer
        }
        
        // Snap to nearest via, pad, test point, power, or ground node unless Option/Alt key is held
        const snapToNearestNode = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
          let bestDist = Infinity;
          let bestPoint: { x: number; y: number; id?: number } | null = null;
          const SNAP_THRESHOLD_WORLD = 15; // Fixed world-space distance (not affected by zoom)
          for (const s of drawingStrokes) {
            if (s.type === 'via' || s.type === 'pad' || s.type === 'testPoint') {
              const c = s.points[0];
              const d = Math.hypot(c.x - wx, c.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = c;
              }
            }
          }
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
        const testPointTypeString = determineTestPointType(nodeId, powerBuses);
        // Map descriptive string to union type
        const testPointType: 'power' | 'ground' | 'signal' | 'unknown' = 
          testPointTypeString.includes('Power') ? 'power' :
          testPointTypeString.includes('Ground') ? 'ground' :
          testPointTypeString.includes('Signal') ? 'signal' :
          'unknown';
        
        // Truncate coordinates to 3 decimal places for exact matching
        const truncatedPos = truncatePoint({ x: snapped.x, y: snapped.y });
        // Use brushColor and brushSize (which are synced with tool registry) for immediate updates
        const testPointColor = brushColor || (testPointToolLayer === 'top' ? topTestPointColor : bottomTestPointColor);
        const testPointSize = brushSize || (testPointToolLayer === 'top' ? topTestPointSize : bottomTestPointSize);
        // Save snapshot before adding new test point
        saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
        
        const testPointStroke: DrawingStroke = {
          id: `${Date.now()}-testPoint`,
          points: [{ id: nodeId, x: truncatedPos.x, y: truncatedPos.y }],
          color: testPointColor,
          size: testPointSize,
          layer: testPointToolLayer, // Use testPointToolLayer instead of selectedDrawingLayer
          type: 'testPoint',
          testPointType: testPointType, // Auto-detected type
        };
        setDrawingStrokes(prev => [...prev, testPointStroke]);
        
        // Don't switch back to select tool - stay in test point tool for multiple placements
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
          (s.type === 'testPoint' && areTestPointsLocked) ||
          (s.type === 'trace' && areTracesLocked)
        )
      );
      if (hasLockedItemsOnLayer) {
        const lockedTypes: string[] = [];
        if (areViasLocked && drawingStrokes.some(s => s.layer === selectedDrawingLayer && s.type === 'via')) lockedTypes.push('vias');
        if (arePadsLocked && drawingStrokes.some(s => s.layer === selectedDrawingLayer && s.type === 'pad')) lockedTypes.push('pads');
        if (areTestPointsLocked && drawingStrokes.some(s => s.layer === selectedDrawingLayer && s.type === 'testPoint')) lockedTypes.push('test points');
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
      // Read from ref to avoid stale closure issues (ref always has the latest value)
      if (!selectedComponentTypeRef.current) {
        return; // Wait for user to select a component type
      }
      
      // Truncate coordinates to 3 decimal places for exact matching
      const truncatedPos = truncatePoint({ x, y });
      // Use tool instance directly (single source of truth) for consistent size/color
      // Read from ref to avoid stale closure issues (ref always has the latest value)
      const layer = componentToolLayerRef.current || 'top';
      const componentInstanceId = layer === 'top' ? 'componentTop' : 'componentBottom';
      const componentInstance = toolInstanceManager.get(componentInstanceId);
      const componentColor = componentInstance.color;
      const componentSize = componentInstance.size;
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
      if (!componentToolLayerRef.current) {
        return; // Wait for user to select a layer
      }
      
      // Use v2 runtime exclusively: component placement is fully data-driven.
      // The data-driven definition comes directly from the component the user selected in the dialog.
      // Read from ref to avoid stale closure issues (ref always has the latest value)
      const dataDrivenDefinition = selectedComponentMetadataRef.current?.dataDrivenDefinition;
      if (!dataDrivenDefinition) {
        console.error('[Component Creation] Missing dataDrivenDefinition metadata for selected component.');
        return;
      }

      let comp: PCBComponent;
      try {
        // componentType is now data-driven from the definition itself
        // No mapping logic needed - createComponentInstance reads it from definition.componentType
        comp = createComponentInstance({
          definition: dataDrivenDefinition,
          layer: componentToolLayerRef.current,
          x: truncatedPos.x,
          y: truncatedPos.y,
          color: componentColor,
          size: componentSize,
          existingComponents: allExistingComponents,
          counters: autoAssignDesignators ? counters : {},
        });
      } catch (error) {
        console.error('[Component Creation] Error creating component with v2 runtime:', error);
        return;
      }
      
      // Initialize abbreviation to default based on component type prefix
      // Read from ref to avoid stale closure issues (ref always has the latest value)
      (comp as any).abbreviation = getDefaultAbbreviation(selectedComponentTypeRef.current);
      
      // IMPORTANT: Update counters immediately after component creation so the next component gets the correct number
      // This ensures that when placing multiple components rapidly, each gets a unique sequential designator
      // Extract prefix from actual designator (works for both v2 and legacy components)
      if (autoAssignDesignators && comp.designator) {
        // Extract prefix and number from designator (e.g., "CE1" -> prefix="CE", number=1)
        const match = comp.designator.match(/^([A-Za-z]+)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const number = parseInt(match[2], 10);
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
      
      // Save snapshot before adding new component
      saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
      
      // Add component to appropriate layer
      // NOTE: This will trigger auto-save change detection via the useEffect that watches componentsTop/componentsBottom
      // Read from ref to avoid stale closure issues (ref always has the latest value)
      if (componentToolLayerRef.current === 'top') {
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
        
        // Save snapshot before adding new power symbol
        saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
        
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
          const newTestPointTypeString = determineTestPointType(snapped.nodeId, powerBuses);
          const newTestPointType: 'power' | 'ground' | 'signal' | 'unknown' = 
            newTestPointTypeString.includes('Power') ? 'power' :
            newTestPointTypeString.includes('Ground') ? 'ground' :
            newTestPointTypeString.includes('Signal') ? 'signal' :
            'unknown';
          setDrawingStrokes(prev => prev.map(s => {
            if (s.type === 'via' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
              return { ...s, viaType: newViaType };
            } else if (s.type === 'pad' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
              return { ...s, padType: newPadType };
            } else if (s.type === 'testPoint' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
              return { ...s, testPointType: newTestPointType };
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
      
      // Save snapshot before adding new ground symbol
      saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
      
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
  }, [currentTool, selectedImageForTransform, brushSize, brushColor, drawingMode, selectedDrawingLayer, drawingStrokes, viewScale, viewPan.x, viewPan.y, viewRotation, viewFlipX, isSnapDisabled, selectedPowerBusId, selectedGroundBusId, powerBuses, groundBuses, selectedComponentType, toolRegistry, padToolLayer, traceToolLayer, testPointToolLayer, powers, grounds, determineViaType, determinePadType, determineTestPointType, showViasLayer, showTopPadsLayer, showBottomPadsLayer]);

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
      const contentCanvasX = canvasX - CONTENT_BORDER;
      const contentCanvasY = canvasY - CONTENT_BORDER;
      // Convert to world coordinates accounting for view rotation and flip
      const worldPos = contentCanvasToWorld(contentCanvasX, contentCanvasY, viewPan, viewScale, viewRotation, viewFlipX);
      const worldX = worldPos.x;
      const worldY = worldPos.y;

    const stepIn = 1.2; // zoom in factor per wheel step
    const stepOut = 1 / stepIn;
    const factor = e.deltaY < 0 ? stepIn : stepOut;
    const newScale = Math.max(0.25, Math.min(8, viewScale * factor));
    // Keep the world point under cursor at the same position - center camera on it
    setCameraCenter(worldX, worldY);
    setViewScale(newScale);
  }, [currentTool, viewScale, viewPan.x, viewPan.y, viewRotation, viewFlipX]);

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
        // Save snapshot before finalizing trace
        saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
        
        // Use centralized tool state (single source of truth)
        // Get tool instance ID from centralized state management
        const layer = traceToolLayer || 'top';
        const traceInstanceId = layer === 'top' ? 'traceTop' : 'traceBottom';
        const traceInstance = toolInstanceManager.get(traceInstanceId);
        const newStroke: DrawingStroke = {
          id: `${Date.now()}-trace`,
          points: pts,
          color: traceInstance.color,
          size: traceInstance.size,
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
    
    // Handle test point double-click to open Notes dialog
    // Works in any tool mode
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
      // Convert to world coordinates accounting for view rotation and flip
      const worldPos = contentCanvasToWorld(contentCanvasX, contentCanvasY, viewPan, viewScale, viewRotation, viewFlipX);
      const x = worldPos.x;
      const y = worldPos.y;
      
    // Check for test point hit
    const hitTolerance = Math.max(8 / viewScale, 4); // Zoom-aware hit tolerance
    const hitTestPoint = (() => {
      for (const stroke of drawingStrokes) {
        if (stroke.type === 'testPoint' && stroke.points.length > 0) {
          const point = stroke.points[0];
          const d = Math.hypot(point.x - x, point.y - y);
          // Test points are diamond-shaped, so use size-based tolerance
          const testPointRadius = (stroke.size || 18) / 2;
          if (d <= testPointRadius + hitTolerance) {
            return stroke;
          }
        }
      }
      return null;
    })();
    
    if (hitTestPoint) {
      // Select the test point and open Notes dialog
      setSelectedIds(new Set([hitTestPoint.id]));
      setSelectedComponentIds(new Set());
      setSelectedPowerIds(new Set());
      setSelectedGroundIds(new Set());
      setNotesDialogVisible(true);
      return;
    }
    
    // Handle component double-click to open properties editor
    // Works in both select tool and component tool
    if (currentTool === 'select' || currentTool === 'component') {
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
      const powerHitTolerance = Math.max(6 / viewScale, 4);
      let hitPower: PowerSymbol | null = null;
      for (const p of powers) {
        const radius = Math.max(6, p.size / 2);
        const lineExtension = radius * 0.8;
        const hitRadius = radius + lineExtension; // Include extended lines in hit detection
        const d = Math.hypot(p.x - x, p.y - y);
        // Check if click is within circle or on extended lines (vertical or horizontal)
        const onVerticalLine = Math.abs(x - p.x) <= powerHitTolerance && Math.abs(y - p.y) <= hitRadius;
        const onHorizontalLine = Math.abs(y - p.y) <= powerHitTolerance && Math.abs(x - p.x) <= hitRadius;
        const inCircle = d <= Math.max(radius, powerHitTolerance);
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
  }, [currentTool, drawingMode, brushColor, brushSize, selectedDrawingLayer, componentsTop, componentsBottom, powers, viewScale, viewPan.x, viewPan.y, viewRotation, viewFlipX, selectedComponentType, isSnapDisabled, drawingStrokes, selectedImageForTransform, isPanning, pendingComponentPosition, connectingPin, toolRegistry, currentStroke, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, setNotesDialogVisible, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds, openComponentEditor]);

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
      
      // Use centralized tool state (single source of truth)
      // Get tool instance ID from centralized state management
      const layer = traceToolLayer || 'top';
      const traceInstanceId = layer === 'top' ? 'traceTop' : 'traceBottom';
      const traceInstance = toolInstanceManager.get(traceInstanceId);
      const newStroke: DrawingStroke = {
        id: `${Date.now()}-trace`,
        points: deduplicated,
        color: traceInstance.color,
        size: traceInstance.size,
        layer: layer,
        type: 'trace',
      };
      // Save snapshot before finalizing trace
      saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
      
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
        // Use centralized tool state (single source of truth)
        const layer = traceToolLayer || 'top';
        const traceInstanceId = layer === 'top' ? 'traceTop' : 'traceBottom';
        const traceInstance = toolInstanceManager.get(traceInstanceId);
        const newStroke: DrawingStroke = {
          id: `${Date.now()}-trace-dot`,
          points: pts,
          color: traceInstance.color,
          size: traceInstance.size,
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
    const angle = angleFromVectorRaw(dx, dy); // -180..180
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
    // Convert to world coordinates accounting for view rotation and flip
    const worldPos = contentCanvasToWorld(contentCanvasX, contentCanvasY, viewPan, viewScale, viewRotation, viewFlipX);
    const x = worldPos.x;
    const y = worldPos.y;
    
    // Update mouse world position for display
    setMouseWorldPos({ x, y });

    // IC Placement mode: update rectangle preview
    if (isDrawingICPlacementRef.current && icPlacementAreaRef.current) {
      setICPlacementArea({
        start: icPlacementAreaRef.current.start,
        end: { x, y },
      });
    }

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
    // Debounced to prevent crashes with many connections (48+ pins) at high zoom
    if (isOptionPressed) {
      // Capture mouse position before debouncing (e is not accessible in callback)
      const mouseClientX = e.clientX;
      const mouseClientY = e.clientY;
      
      // Clear any existing debounce timeout
      if (hoverDebounceTimeoutRef.current !== null) {
        clearTimeout(hoverDebounceTimeoutRef.current);
      }
      
      // Debounce hover detection with 50ms delay to reduce excessive renders
      // while keeping the UI feeling responsive
      hoverDebounceTimeoutRef.current = window.setTimeout(() => {
        hoverDebounceTimeoutRef.current = null;
        
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
          // Only update if component changed
          if (lastHoverStateRef.current?.componentId !== hitComponent.comp.id) {
            setHoverComponent({ 
              component: hitComponent.comp, 
              layer: hitComponent.layer,
              x: mouseClientX,
              y: mouseClientY
            });
            setHoverTestPoint(null);
            setHoverConnection(null);
            lastHoverStateRef.current = { type: 'component', componentId: hitComponent.comp.id };
            // Clear tooltip cache when component changes
            tooltipCacheRef.current = null;
          }
        } else {
          // Only clear if we had a component hovered
          if (lastHoverStateRef.current?.type === 'component') {
            setHoverComponent(null);
            lastHoverStateRef.current = null;
            tooltipCacheRef.current = null;
          }
          
          // Test Point hover detection (only when Option key is held and no component is hovered)
          const hitTolerance = Math.max(8 / viewScale, 4);
          const hitTestPoint = (() => {
            for (const stroke of drawingStrokes) {
              if (stroke.type === 'testPoint' && stroke.points.length > 0) {
                const point = stroke.points[0];
                const d = Math.hypot(point.x - x, point.y - y);
                const testPointRadius = (stroke.size || 18) / 2;
                if (d <= testPointRadius + hitTolerance) {
                  return stroke;
                }
              }
            }
            return null;
          })();
          
          if (hitTestPoint) {
            if (lastHoverStateRef.current?.testPointId !== hitTestPoint.id) {
              setHoverTestPoint({
                stroke: hitTestPoint,
                x: mouseClientX,
                y: mouseClientY
              });
              setHoverConnection(null);
              lastHoverStateRef.current = { type: 'testPoint', testPointId: hitTestPoint.id };
            }
          } else {
            if (lastHoverStateRef.current?.type === 'testPoint') {
              setHoverTestPoint(null);
              lastHoverStateRef.current = null;
            }
            
            // Pad/Via hover detection - shows which IC pins connect to this pad/via
            // This is much simpler and more accurate than line hover detection:
            // 1. Check if mouse is over a pad/via (simple circle hit test)
            // 2. If yes, look up which IC pins connect to it (reverse lookup)
            // 3. Display the connection info
            // Use a small tolerance - we want precise hits on the actual pad
            const padHitTolerance = Math.max(4 / viewScale, 2);
            
            // Step 1: Find the CLOSEST pad/via under mouse (not just the first one)
            let hitPadVia: { stroke: DrawingStroke; pointId: number } | null = null;
            let closestDistance = Infinity;
            
            for (const stroke of drawingStrokes) {
              if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
                const point = stroke.points[0];
                const radius = Math.max(stroke.size / 2, 4);
                const d = Math.hypot(point.x - x, point.y - y);
                // Check if within hit range AND closer than any previous hit
                if (d <= radius + padHitTolerance && point.id !== undefined && d < closestDistance) {
                  hitPadVia = { stroke, pointId: point.id };
                  closestDistance = d;
                  // Don't break - keep looking for closer pads
                }
              }
            }
            
            if (hitPadVia) {
              // Step 2: Find which IC pins connect to this pad/via
              const nodeIdStr = hitPadVia.pointId.toString();
              const allComponents = [
                ...componentsTop.map(c => ({ comp: c, layer: 'top' as const })),
                ...componentsBottom.map(c => ({ comp: c, layer: 'bottom' as const }))
              ];
              
              // Find the first semiconductor that has this node in its pinConnections
              let hitConnection: { comp: PCBComponent; layer: 'top' | 'bottom'; pinIndices: number[]; nodeIdStr: string } | null = null;
              
              for (const { comp, layer } of allComponents) {
                const compDef = resolveComponentDefinition(comp as any);
                if (compDef?.category !== 'Semiconductors') continue;
                
                const pinConnections = comp.pinConnections || [];
                const connectedPinIndices: number[] = [];
                
                // Find all pins that connect to this node
                for (let pinIndex = 0; pinIndex < pinConnections.length; pinIndex++) {
                  const connection = pinConnections[pinIndex];
                  if (connection && connection.trim() === nodeIdStr) {
                    connectedPinIndices.push(pinIndex);
                  }
                }
                
                if (connectedPinIndices.length > 0) {
                  hitConnection = { comp, layer, pinIndices: connectedPinIndices, nodeIdStr };
                  break; // Found a connection, stop searching
                }
              }
              
              // Step 3: Update hover state
              if (hitConnection) {
                const newKey = `${hitConnection.comp.id}-${hitConnection.nodeIdStr}`;
                if (lastHoverStateRef.current?.connectionKey !== newKey) {
                  setHoverConnection({
                    component: hitConnection.comp,
                    layer: hitConnection.layer,
                    pinIndices: hitConnection.pinIndices,
                    nodeId: hitConnection.nodeIdStr,
                    x: mouseClientX,
                    y: mouseClientY,
                    stroke: hitPadVia.stroke
                  });
                  lastHoverStateRef.current = { type: 'connection', connectionKey: newKey };
                }
              } else {
                // Pad/via exists but no IC connection found
                if (lastHoverStateRef.current?.type === 'connection') {
                  setHoverConnection(null);
                  lastHoverStateRef.current = null;
                }
              }
            } else {
              // No pad/via under mouse
              if (lastHoverStateRef.current?.type === 'connection') {
                setHoverConnection(null);
                lastHoverStateRef.current = null;
              }
            }
          }
        }
      }, 50); // 50ms debounce delay - responsive but prevents excessive renders
    } else {
      // Clear all hover states when Option key is released
      if (hoverDebounceTimeoutRef.current !== null) {
        clearTimeout(hoverDebounceTimeoutRef.current);
        hoverDebounceTimeoutRef.current = null;
      }
      if (lastHoverStateRef.current) {
        setHoverComponent(null);
        setHoverTestPoint(null);
        setHoverConnection(null);
        lastHoverStateRef.current = null;
        tooltipCacheRef.current = null;
      }
    }

    // Component dragging is started immediately on click-and-hold, so no threshold check needed
    
    if (currentTool === 'select' && isSelecting && selectStart) {
      const sx = selectStart.x;
      const sy = selectStart.y;
      setSelectRect({ x: Math.min(sx, x), y: Math.min(sy, y), width: Math.abs(x - sx), height: Math.abs(y - sy) });
    } else if (currentTool === 'pan' && isPanning && panStartRef.current) {
      const { startCX, startCY, objectStartPositions } = panStartRef.current;
      const dx = contentCanvasX - startCX;
      const dy = contentCanvasY - startCY;
      // Convert canvas delta to world delta accounting for view rotation and flip
      // This ensures objects move the same distance and direction as the mouse
      const worldDelta = canvasDeltaToWorldDelta(dx, dy, viewScale, viewRotation, viewFlipX);
      const worldDeltaX = worldDelta.x;
      const worldDeltaY = worldDelta.y;
      
      // Move all objects by the world delta (keep origin fixed at center)
      if (objectStartPositions) {
        // Move images
        if (topImage) {
          setTopImage({ ...topImage, x: objectStartPositions.topImageX + worldDeltaX, y: objectStartPositions.topImageY + worldDeltaY });
        }
        if (bottomImage) {
          setBottomImage({ ...bottomImage, x: objectStartPositions.bottomImageX + worldDeltaX, y: objectStartPositions.bottomImageY + worldDeltaY });
        }
        
        // Move components
        setComponentsTop(componentsTop.map(comp => ({
          ...comp,
          x: (objectStartPositions.componentsTop?.[comp.id]?.x ?? comp.x) + worldDeltaX,
          y: (objectStartPositions.componentsTop?.[comp.id]?.y ?? comp.y) + worldDeltaY
        })));
        setComponentsBottom(componentsBottom.map(comp => ({
          ...comp,
          x: (objectStartPositions.componentsBottom?.[comp.id]?.x ?? comp.x) + worldDeltaX,
          y: (objectStartPositions.componentsBottom?.[comp.id]?.y ?? comp.y) + worldDeltaY
        })));
        
        // Move power symbols
        setPowerSymbols(powerSymbols.map(p => ({
          ...p,
          x: (objectStartPositions.powerSymbols?.[p.id]?.x ?? p.x) + worldDeltaX,
          y: (objectStartPositions.powerSymbols?.[p.id]?.y ?? p.y) + worldDeltaY
        })));
        
        // Move ground symbols
        setGroundSymbols(groundSymbols.map(g => ({
          ...g,
          x: (objectStartPositions.groundSymbols?.[g.id]?.x ?? g.x) + worldDeltaX,
          y: (objectStartPositions.groundSymbols?.[g.id]?.y ?? g.y) + worldDeltaY
        })));
        
        // Move drawing strokes (all points in each stroke)
        setDrawingStrokes(drawingStrokes.map((stroke, idx) => ({
          ...stroke,
          points: stroke.points.map((point, pointIdx) => {
            const startPoint = objectStartPositions.drawingStrokes?.[idx]?.points?.[pointIdx];
            return {
              ...point,
              x: (startPoint?.x ?? point.x) + worldDeltaX,
              y: (startPoint?.y ?? point.y) + worldDeltaY
            };
          })
        })));
        
        // Move vias
        setVias(vias.map((via, idx) => {
          const startVia = objectStartPositions.vias?.[idx];
          return {
            ...via,
            x: (startVia?.x ?? via.x) + worldDeltaX,
            y: (startVia?.y ?? via.y) + worldDeltaY
          };
        }));
        
        // Move pads
        setPads(pads.map((pad, idx) => {
          const startPad = objectStartPositions.pads?.[idx];
          return {
            ...pad,
            x: (startPad?.x ?? pad.x) + worldDeltaX,
            y: (startPad?.y ?? pad.y) + worldDeltaY
          };
        }));
      }
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
            if (stroke.type === 'testPoint' && areTestPointsLocked) return true;
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
          // Save snapshot before erasing components
          saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
          
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
      
      // Explicitly check which image(s) to transform based on selectedImageForTransform
      // Only transform the specifically selected image, not both
      if (selectedImageForTransform === 'top') {
        // Only move top image - do not move bottom
        if (topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        }
        setTransformStartPos({ x, y });
        return;
      }
      
      if (selectedImageForTransform === 'bottom') {
        // Only move bottom image - do not move top
        if (bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        }
        setTransformStartPos({ x, y });
        return;
      }
      
      if (selectedImageForTransform === 'both') {
        // Apply transform to both images only when 'both' is explicitly selected
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
        setTransformStartPos({ x, y });
        return;
      }
    }
  }, [isDrawing, currentStroke, currentTool, brushSize, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage, isShiftConstrained, snapConstrainedPoint, selectedDrawingLayer, setDrawingStrokes, viewScale, viewPan.x, viewPan.y, viewRotation, viewFlipX, isSelecting, selectStart, areImagesLocked, areViasLocked, arePadsLocked, areTracesLocked, arePowerNodesLocked, areGroundNodesLocked, componentsTop, componentsBottom, setComponentsTop, setComponentsBottom, isOptionPressed, setHoverComponent, isSnapDisabled, drawingStrokes, powers, grounds, currentStroke, drawingMode, tracePreviewMousePos, setTracePreviewMousePos, isPanning, panStartRef, setViewPan, CONTENT_BORDER, viewPan, generatePointId, truncatePoint, setCurrentTool, setIsWaitingForHomeViewKey, saveSnapshot, powerSymbols, groundSymbols, setMouseWorldPos]);

  const handleCanvasMouseUp = useCallback(() => {
    // Clear mouse world position when mouse leaves canvas
    setMouseWorldPos(null);
    
    // IC Placement mode: finalize and draw vias/pads
    if (isICPlacementModeRef.current && icPlacementAreaRef.current && icPlacementOptionsRef.current && isDrawingICPlacementRef.current) {
      const area = icPlacementAreaRef.current;
      const options = icPlacementOptionsRef.current;
      const width = Math.abs(area.end.x - area.start.x);
      const height = Math.abs(area.end.y - area.start.y);
      
      // Validate minimum size
      if (width >= 1 && height >= 1) {
        try {
          const padLocations = generateICPlacementPads({
            numPins: options.numPins,
            type: options.type,
            twoSidedOrientation: options.twoSidedOrientation,
            zigzagOrientation: options.zigzagOrientation,
            point1: area.start,
            point2: area.end,
          });
          
          // CRITICAL: Use generatePointId() for each pad to ensure globally unique NodeIds
          // This matches the approach used for individual via/pad creation and ensures:
          // 1. IDs are properly registered in the allocatedIds set
          // 2. The global nextPointId counter is correctly incremented
          // 3. No duplicate IDs can ever be generated
          // Create drawing strokes for each pad location
          const newStrokes: DrawingStroke[] = padLocations.map((pad) => {
            const instanceId = icPlacementIsPadRef.current 
              ? ((padToolLayer || 'top') === 'top' ? 'padTop' : 'padBottom')
              : 'via';
            const instance = toolInstanceManager.get(instanceId);
            // Use generatePointId() to ensure uniqueness (same as individual via/pad creation)
            const nodeId = generatePointId();
            const layer = icPlacementIsPadRef.current ? (padToolLayer || 'top') : 'top';
            return {
              id: nodeId.toString(),
              type: icPlacementIsPadRef.current ? 'pad' : 'via',
              points: [{ x: pad.x, y: pad.y, id: nodeId }],
              size: instance.size,
              color: instance.color,
              layer: layer,
            };
          });
          
          // Add strokes to drawing
          setDrawingStrokes(prev => {
            const updated = [...prev, ...newStrokes];
            // Save snapshot for undo with updated strokes
            saveSnapshot(updated, componentsTop, componentsBottom, powerSymbols, groundSymbols);
            return updated;
          });
        } catch (error) {
          console.error('IC Placement error:', error);
          alert(`Error placing ${icPlacementIsPadRef.current ? 'pads' : 'vias'}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Reset IC placement state
      setIsICPlacementMode(false);
      setICPlacementArea(null);
      setICPlacementOptions(null);
      setIsDrawingICPlacement(false);
      isICPlacementModeRef.current = false;
      icPlacementAreaRef.current = null;
      icPlacementOptionsRef.current = null;
      isDrawingICPlacementRef.current = false;
      setCanvasCursor(undefined);
      setCurrentTool('select');
      return;
    }
    
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
                // Toggle selection - use functional update to ensure we work with latest state
                setSelectedIds(prev => {
                  const next = new Set(prev);
                  if (next.has(hitStrokeId)) {
                    next.delete(hitStrokeId);
                  } else {
                    next.add(hitStrokeId);
                  }
                  return next;
                });
                // Keep other selections when Shift-clicking
              } else {
                // Replace selection
                setSelectedIds(new Set([hitStrokeId]));
                // Clear other selections
                setSelectedComponentIds(new Set());
                setSelectedPowerIds(new Set());
                setSelectedGroundIds(new Set());
              }
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
            if (s.type === 'via') {
              isVisible = showViasLayer;
            } else if (s.type === 'pad') {
              // Pads have layer-specific visibility
              const padLayer = s.layer || 'top';
              isVisible = padLayer === 'top' ? showTopPadsLayer : showBottomPadsLayer;
            } else if (s.type === 'testPoint') {
              // Test points have layer-specific visibility - check their own layer, not trace layer
              const testPointLayer = s.layer || 'top';
              isVisible = testPointLayer === 'top' ? showTopTestPointsLayer : showBottomTestPointsLayer;
            } else if (s.type === 'trace') {
              // Traces have layer-specific visibility
              isVisible = s.layer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
            } else {
              // Unknown type or default - don't show
              isVisible = false;
            }
            if (!isVisible) continue;
            
            let dist = Infinity;
            if (s.type === 'via' || s.type === 'pad' || s.type === 'testPoint') {
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
            if (shiftWasPressed) {
              // Toggle selection
              if (next.has(bestHit.id)) {
                next.delete(bestHit.id);
              } else {
                next.add(bestHit.id);
              }
            } else {
              // Replace selection
              next.add(bestHit.id);
            }
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
            } else if (s.type === 'testPoint') {
              // Test points have layer-specific visibility - check their own layer, not trace layer
              const testPointLayer = s.layer || 'top';
              isVisible = testPointLayer === 'top' ? showTopTestPointsLayer : showBottomTestPointsLayer;
            } else if (s.type === 'trace') {
              // Traces have layer-specific visibility
              isVisible = s.layer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
            } else {
              // Unknown type or default - don't show
              isVisible = false;
            }
            if (!isVisible) continue;
            
            let hit = false;
            if (s.type === 'via' || s.type === 'pad' || s.type === 'testPoint') {
              const c = s.points[0];
              hit = withinRect(c.x, c.y);
            } else {
              for (let i = 0; i < s.points.length - 1; i++) {
                const p1 = s.points[i], p2 = s.points[i + 1];
                if (segIntersectsRect(p1.x, p1.y, p2.x, p2.y, minX, minY, maxX, maxY) ||
                    (withinRect(p1.x, p1.y) && withinRect(p2.x, p2.y))) { hit = true; break; }
              }
            }
            if (hit) {
              if (shiftWasPressed) {
                // Toggle selection
                if (next.has(s.id)) {
                  next.delete(s.id);
                } else {
                  next.add(s.id);
                }
              } else {
                // Add to selection
                next.add(s.id);
              }
            }
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
            componentsTop.forEach(c => {
              if (clickInComp(c)) {
                if (shiftWasPressed) {
                  // Toggle selection
                  if (nextComps.has(c.id)) {
                    nextComps.delete(c.id);
                  } else {
                    nextComps.add(c.id);
                  }
                } else {
                  // Add to selection
                  nextComps.add(c.id);
                }
              }
            });
          }
          if (showBottomComponents) {
            componentsBottom.forEach(c => {
              if (clickInComp(c)) {
                if (shiftWasPressed) {
                  // Toggle selection
                  if (nextComps.has(c.id)) {
                    nextComps.delete(c.id);
                  } else {
                    nextComps.add(c.id);
                  }
                } else {
                  // Add to selection
                  nextComps.add(c.id);
                }
              }
            });
          }
        } else {
          if (showTopComponents) {
            componentsTop.forEach(c => {
              if (compInRect(c)) {
                if (shiftWasPressed) {
                  // Toggle selection
                  if (nextComps.has(c.id)) {
                    nextComps.delete(c.id);
                  } else {
                    nextComps.add(c.id);
                  }
                } else {
                  // Add to selection
                  nextComps.add(c.id);
                }
              }
            });
          }
          if (showBottomComponents) {
            componentsBottom.forEach(c => {
              if (compInRect(c)) {
                if (shiftWasPressed) {
                  // Toggle selection
                  if (nextComps.has(c.id)) {
                    nextComps.delete(c.id);
                  } else {
                    nextComps.add(c.id);
                  }
                } else {
                  // Add to selection
                  nextComps.add(c.id);
                }
              }
            });
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
              if (shiftWasPressed) {
                // Toggle selection
                if (nextPowers.has(bestPowerHit.id)) {
                  nextPowers.delete(bestPowerHit.id);
                } else {
                  nextPowers.add(bestPowerHit.id);
                }
              } else {
                // Add to selection
                nextPowers.add(bestPowerHit.id);
              }
            }
          } else {
            // Rectangle selection: find all power nodes in rect
            powers.forEach(p => {
              if (powerInRect(p)) {
                if (shiftWasPressed) {
                  // Toggle selection
                  if (nextPowers.has(p.id)) {
                    nextPowers.delete(p.id);
                  } else {
                    nextPowers.add(p.id);
                  }
                } else {
                  // Add to selection
                  nextPowers.add(p.id);
                }
              }
            });
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
              if (shiftWasPressed) {
                // Toggle selection
                if (nextGrounds.has(bestGroundHit.id)) {
                  nextGrounds.delete(bestGroundHit.id);
                } else {
                  nextGrounds.add(bestGroundHit.id);
                }
              } else {
                // Add to selection
                nextGrounds.add(bestGroundHit.id);
              }
            }
          } else {
            // Rectangle selection: find all ground nodes in rect
            grounds.forEach(g => {
              if (groundInRect(g)) {
                if (shiftWasPressed) {
                  // Toggle selection
                  if (nextGrounds.has(g.id)) {
                    nextGrounds.delete(g.id);
                  } else {
                    nextGrounds.add(g.id);
                  }
                } else {
                  // Add to selection
                  nextGrounds.add(g.id);
                }
              }
            });
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
  }, [isDrawing, currentStroke, currentTool, brushColor, brushSize, selectedDrawingLayer, selectRect, selectStart, isSelecting, drawingStrokes, viewScale, isShiftPressed, selectedIds, powers, grounds, componentsTop, componentsBottom, selectedComponentIds, selectedPowerIds, selectedGroundIds, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer, setMouseWorldPos]);

  // Allow panning to continue even when the pointer leaves the canvas while the button is held
  React.useEffect(() => {
    if (!(currentTool === 'pan' && isPanning && panClientStartRef.current)) return;
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const { startClientX, startClientY, objectStartPositions } = panClientStartRef.current!;
      const dx = (e.clientX - startClientX) * scaleX;
      const dy = (e.clientY - startClientY) * scaleY;
      // Convert canvas delta to world delta accounting for view rotation and flip
      // This ensures objects move the same distance and direction as the mouse
      const worldDelta = canvasDeltaToWorldDelta(dx, dy, viewScale, viewRotation, viewFlipX);
      const worldDeltaX = worldDelta.x;
      const worldDeltaY = worldDelta.y;
      
      // Move all objects by the world delta (keep origin fixed at center)
      if (objectStartPositions) {
        // Move images
        if (topImage) {
          setTopImage({ ...topImage, x: objectStartPositions.topImageX + worldDeltaX, y: objectStartPositions.topImageY + worldDeltaY });
        }
        if (bottomImage) {
          setBottomImage({ ...bottomImage, x: objectStartPositions.bottomImageX + worldDeltaX, y: objectStartPositions.bottomImageY + worldDeltaY });
        }
        
        // Move components
        setComponentsTop(componentsTop.map(comp => ({
          ...comp,
          x: (objectStartPositions.componentsTop?.[comp.id]?.x ?? comp.x) + worldDeltaX,
          y: (objectStartPositions.componentsTop?.[comp.id]?.y ?? comp.y) + worldDeltaY
        })));
        setComponentsBottom(componentsBottom.map(comp => ({
          ...comp,
          x: (objectStartPositions.componentsBottom?.[comp.id]?.x ?? comp.x) + worldDeltaX,
          y: (objectStartPositions.componentsBottom?.[comp.id]?.y ?? comp.y) + worldDeltaY
        })));
        
        // Move power symbols
        setPowerSymbols(powerSymbols.map(p => ({
          ...p,
          x: (objectStartPositions.powerSymbols?.[p.id]?.x ?? p.x) + worldDeltaX,
          y: (objectStartPositions.powerSymbols?.[p.id]?.y ?? p.y) + worldDeltaY
        })));
        
        // Move ground symbols
        setGroundSymbols(groundSymbols.map(g => ({
          ...g,
          x: (objectStartPositions.groundSymbols?.[g.id]?.x ?? g.x) + worldDeltaX,
          y: (objectStartPositions.groundSymbols?.[g.id]?.y ?? g.y) + worldDeltaY
        })));
        
        // Move drawing strokes (all points in each stroke)
        setDrawingStrokes(drawingStrokes.map((stroke, idx) => ({
          ...stroke,
          points: stroke.points.map((point, pointIdx) => {
            const startPoint = objectStartPositions.drawingStrokes?.[idx]?.points?.[pointIdx];
            return {
              ...point,
              x: (startPoint?.x ?? point.x) + worldDeltaX,
              y: (startPoint?.y ?? point.y) + worldDeltaY
            };
          })
        })));
        
        // Move vias
        setVias(vias.map((via, idx) => {
          const startVia = objectStartPositions.vias?.[idx];
          return {
            ...via,
            x: (startVia?.x ?? via.x) + worldDeltaX,
            y: (startVia?.y ?? via.y) + worldDeltaY
          };
        }));
        
        // Move pads
        setPads(pads.map((pad, idx) => {
          const startPad = objectStartPositions.pads?.[idx];
          return {
            ...pad,
            x: (startPad?.x ?? pad.x) + worldDeltaX,
            y: (startPad?.y ?? pad.y) + worldDeltaY
          };
        }));
      }
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
  }, [currentTool, isPanning, viewScale, viewRotation, viewFlipX, topImage, bottomImage, componentsTop, componentsBottom, powerSymbols, groundSymbols, drawingStrokes, vias, pads, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setPowerSymbols, setGroundSymbols, setDrawingStrokes, setVias, setPads]);


  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill border area with black
    ctx.fillStyle = '#000000'; // black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Fill content area with white (will be drawn over by content)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(CONTENT_BORDER, CONTENT_BORDER, canvas.width - 2 * CONTENT_BORDER, canvas.height - 2 * CONTENT_BORDER);

    // Clip to content area (exclude fixed border), then translate origin to content top-left
    ctx.save();
    ctx.beginPath();
    ctx.rect(CONTENT_BORDER, CONTENT_BORDER, canvas.width - 2 * CONTENT_BORDER, canvas.height - 2 * CONTENT_BORDER);
    ctx.clip();
    ctx.translate(CONTENT_BORDER, CONTENT_BORDER);

    // Draw with perspective-like keystone using slice warping via offscreen canvases
    // Uses caching to prevent memory leaks from creating new canvas elements on every draw
    const drawImageWithKeystone = (
      ctxTarget: CanvasRenderingContext2D,
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      keystoneV: number,
      keystoneH: number,
      destW: number,
      destH: number,
      cacheKey?: string, // Optional cache key for this image/keystone combination
    ) => {
      // Check cache first if we have a key
      if (cacheKey) {
        const cached = keystoneCacheRef.current.get(cacheKey);
        if (cached) {
          ctxTarget.drawImage(cached, -destW / 2, -destH / 2, destW, destH);
          return;
        }
      }

      const base = document.createElement('canvas');
      base.width = srcW;
      base.height = srcH;
      const bctx = base.getContext('2d', { willReadFrequently: true })!;
      bctx.clearRect(0, 0, srcW, srcH);
      bctx.drawImage(source as any, 0, 0, srcW, srcH);

      let current = base;

      if (Math.abs(keystoneV) > 1e-6) {
        const tanV = tan(keystoneV);
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
        // Clean up intermediate canvas if it's not the final result
        if (Math.abs(keystoneH) <= 1e-6) {
          // This is the final result, keep it
        } else {
          // Will be replaced by temp2, but we'll keep current for now
        }
        current = temp;
      }

      if (Math.abs(keystoneH) > 1e-6) {
        const tanH = tan(keystoneH);
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

      // Cache the result if we have a key
      if (cacheKey) {
        keystoneCacheRef.current.set(cacheKey, current);
      }

      ctxTarget.drawImage(current, -destW / 2, -destH / 2, destW, destH);
    };

    // Apply global view transform: pan, scale, rotation, flip
    // This ensures all objects are transformed consistently by the view perspective
    ctx.translate(viewPan.x, viewPan.y);
    ctx.scale(viewScale, viewScale);
    // Apply view rotation and flip using unified library
    // Flip around the vertical axis of the canvas (camera center) to ensure perspective change
    // doesn't affect world coordinates. At this point, the origin (0,0) is at the camera center
    // after pan/scale, so flipping around the origin flips around the vertical axis.
    applyViewTransform(ctx, viewRotation, viewFlipX);
    
    // Draw images with transformations (locked and unlocked use same coordinate system)
    // Locked images just can't be transformed, but they appear in the same position
    {
    const overlayMode = showTopImage && showBottomImage;
      
    if (topImage && topImage.bitmap && showTopImage) {
      const bmp = topImage.bitmap;
      ctx.save();
      ctx.globalAlpha = 1;
      // Build filter string with brightness, contrast, and grayscale
      const filters: string[] = [];
      if (topImage.brightness !== undefined && topImage.brightness !== 100) {
        filters.push(`brightness(${topImage.brightness}%)`);
      }
      if (topImage.contrast !== undefined && topImage.contrast !== 100) {
        filters.push(`contrast(${topImage.contrast}%)`);
      }
      // Apply grayscale filter if enabled
      if (isGrayscale) {
        filters.push('grayscale(100%)');
      }
      ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
      // Apply per-image transformations using unified library
        // Images are stored with x,y values that are updated during transforms in world coordinates
        // So we can use them directly as world coordinates (the view transform is already applied)
        applyTransform(ctx, {
          x: topImage.x,
          y: topImage.y,
          rotation: topImage.rotation || 0,
          scale: topImage.scale || 1,
          flipX: topImage.flipX || false,
          flipY: topImage.flipY || false,
          skewX: topImage.skewX || 0,
          skewY: topImage.skewY || 0,
        });
      const scaledWidth = bmp.width * 1; // already accounted by ctx.scale above
      const scaledHeight = bmp.height * 1;
      const sourceToDraw: CanvasImageSource = bmp;
      if ((topImage.keystoneV && Math.abs(topImage.keystoneV) > 1e-6) || (topImage.keystoneH && Math.abs(topImage.keystoneH) > 1e-6)) {
        const cacheKey = `top-${topImage.name || 'top'}-${topImage.keystoneV || 0}-${topImage.keystoneH || 0}-${bmp.width}-${bmp.height}`;
        drawImageWithKeystone(ctx, sourceToDraw, bmp.width, bmp.height, topImage.keystoneV || 0, topImage.keystoneH || 0, scaledWidth, scaledHeight, cacheKey);
      } else {
        ctx.drawImage(sourceToDraw, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    if (bottomImage && bottomImage.bitmap && showBottomImage) {
      const bmp = bottomImage.bitmap;
      ctx.save();
      ctx.globalAlpha = overlayMode ? (transparency / 100) : 1;
      // Build filter string with brightness, contrast, and grayscale
      const filters: string[] = [];
      if (bottomImage.brightness !== undefined && bottomImage.brightness !== 100) {
        filters.push(`brightness(${bottomImage.brightness}%)`);
      }
      if (bottomImage.contrast !== undefined && bottomImage.contrast !== 100) {
        filters.push(`contrast(${bottomImage.contrast}%)`);
      }
      // Apply grayscale filter if enabled
      if (isGrayscale) {
        filters.push('grayscale(100%)');
      }
      ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
      // Apply per-image transformations using unified library
        // Images are stored with x,y values that are updated during transforms in world coordinates
        // So we can use them directly as world coordinates (the view transform is already applied)
        applyTransform(ctx, {
          x: bottomImage.x,
          y: bottomImage.y,
          rotation: bottomImage.rotation || 0,
          scale: bottomImage.scale || 1,
          flipX: bottomImage.flipX || false,
          flipY: bottomImage.flipY || false,
          skewX: bottomImage.skewX || 0,
          skewY: bottomImage.skewY || 0,
        });
      const scaledWidth = bmp.width * 1;
      const scaledHeight = bmp.height * 1;
      const sourceToDrawB: CanvasImageSource = bmp;
      if ((bottomImage.keystoneV && Math.abs(bottomImage.keystoneV) > 1e-6) || (bottomImage.keystoneH && Math.abs(bottomImage.keystoneH) > 1e-6)) {
        const cacheKey = `bottom-${bottomImage.name || 'bottom'}-${bottomImage.keystoneV || 0}-${bottomImage.keystoneH || 0}-${bmp.width}-${bmp.height}`;
        drawImageWithKeystone(ctx, sourceToDrawB, bmp.width, bmp.height, bottomImage.keystoneV || 0, bottomImage.keystoneH || 0, scaledWidth, scaledHeight, cacheKey);
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
        // Apply transformations using unified library
        applySimpleTransform(
          ctx,
          p.x,
          p.y,
          p.rotation ?? 0,
          p.flipX ?? false,
          false // Power symbols don't have flipY
        );
        
        // Draw flash highlight
        if (flashObjectId === p.id) {
          ctx.save();
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 4 / viewScale;
          const r = (p.size / 2) + (8 / viewScale);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TWO_PI);
          ctx.stroke();
          ctx.restore();
        }

        // Find the power bus to get its voltage and color
        const bus = powerBuses.find(b => b.id === p.powerBusId);
        const isSelected = selectedPowerIds.has(p.id);
        const powerColor = bus?.color || '#ff0000'; // Use bus color, default to red if bus not found
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
          ctx.arc(0, 0, radius + lineExtension + 3, 0, TWO_PI);
          ctx.stroke();
        }
        
        // Draw empty circle (not filled)
        ctx.strokeStyle = powerColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, TWO_PI);
        ctx.stroke();
        
        // Draw vertical line extending above and below the circle
        ctx.beginPath();
        ctx.moveTo(0, -radius - lineExtension);
        ctx.lineTo(0, radius + lineExtension);
        ctx.stroke();
        
        // Draw horizontal line extending left and right of the circle
        ctx.beginPath();
        ctx.moveTo(-radius - lineExtension, 0);
        ctx.lineTo(radius + lineExtension, 0);
        ctx.stroke();
        
        // Draw bus name label below the icon if bus is found
        if (bus) {
          ctx.fillStyle = powerColor;
          const fontSize = Math.max(10, radius * 0.8);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // Position text below the icon (below the vertical line extension)
          ctx.fillText(bus.name, 0, radius + lineExtension + 8);
        }
        ctx.restore();
      };
      powers.forEach(drawPower);
    }
    if (showGroundLayer && grounds.length > 0) {
      const drawGround = (g: GroundSymbol) => {
        ctx.save();
        // Apply transformations using unified library
        applySimpleTransform(
          ctx,
          g.x,
          g.y,
          g.rotation ?? 0,
          g.flipX ?? false,
          false // Ground symbols don't have flipY
        );
        
        // Draw flash highlight
        if (flashObjectId === g.id) {
          ctx.save();
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 4 / viewScale;
          const r = (g.size / 2) + (8 / viewScale);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TWO_PI);
          ctx.stroke();
          ctx.restore();
        }

        const isSelected = selectedGroundIds.has(g.id);
        
        // Find the ground bus to get its name and color
        const bus = groundBuses.find(b => b.id === g.groundBusId);
        const groundColor = bus?.color || g.color || '#000000'; // Use bus color if available, fallback to stored color
        
        // Check if this is Earth Ground (use Earth Ground symbol)
        const isEarthGround = g.groundBusId === 'groundbus-earth';
        
        let bottomY: number; // Track the bottom of the icon for text positioning
        
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
            ctx.strokeRect(-width / 2 - 3, -3, width + 6, vLen + barG * 2 + 6);
            ctx.setLineDash([]);
          }
          
          ctx.strokeStyle = groundColor;
          ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
          
          // Vertical line (from top)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, vLen);
          ctx.stroke();
          
          // Three horizontal bars (progressively shorter)
          for (let i = 0; i < 3; i++) {
            const barY = vLen + i * barG;
            const barWidth = width * (1 - i * 0.25); // Each bar is 25% shorter than previous
            ctx.beginPath();
            ctx.moveTo(-barWidth / 2, barY);
            ctx.lineTo(barWidth / 2, barY);
            ctx.stroke();
          }
          
          // Bottom of Earth Ground symbol is after the 3rd bar
          bottomY = vLen + barG * 2;
        } else {
          // Draw GND or other ground symbol: circle with lines
        const radius = Math.max(6, (g.size || 18) / 2);
        const lineExtension = radius * 0.8; // Lines extend outside the circle
        
        // Draw selection highlight if selected
        if (isSelected) {
          ctx.strokeStyle = '#0066ff';
          ctx.lineWidth = Math.max(1, 4 / Math.max(viewScale, 0.001));
          ctx.beginPath();
          ctx.arc(0, 0, radius + lineExtension + 3, 0, TWO_PI);
          ctx.stroke();
        }
        
        // Draw empty circle (not filled)
        ctx.strokeStyle = groundColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, TWO_PI);
        ctx.stroke();
        
        // Draw vertical line extending above and below the circle
        ctx.beginPath();
        ctx.moveTo(0, -radius - lineExtension);
        ctx.lineTo(0, radius + lineExtension);
        ctx.stroke();
        
        // Draw horizontal line extending left and right of the circle
        ctx.beginPath();
        ctx.moveTo(-radius - lineExtension, 0);
        ctx.lineTo(radius + lineExtension, 0);
        ctx.stroke();
        
        // Bottom of GND symbol is below the vertical line extension
        bottomY = radius + lineExtension;
        }
        
        // Draw ground bus name label below the icon if bus is found
        if (bus) {
          ctx.fillStyle = groundColor;
          const fontSize = Math.max(10, (g.size || 18) * 0.5);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // Position text below the icon
          ctx.fillText(bus.name, 0, bottomY + 8);
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
      
      // Translate to component position first (in world coordinates, already transformed by view)
      ctx.translate(c.x, c.y);
      
      // Apply inverse view transform to keep component upright relative to canvas
      // This undoes the view rotation and flip so components remain readable
      applyInverseViewTransform(ctx, viewRotation, viewFlipX);
      
      // Apply component's own rotation and flip
      if (c.orientation !== undefined && c.orientation !== 0) {
        ctx.rotate(degToRad(c.orientation));
      }
      if (c.flipX) {
        ctx.scale(-1, 1);
      }
      if (c.flipY) {
        ctx.scale(1, -1);
      }
      
      // Draw flash highlight
      if (flashObjectId === c.id) {
        ctx.save();
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 4 / viewScale;
        const r = (size / 2) + (6 / viewScale);
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }

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
      ctx.rect(-half, -half, size, size);
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
        ctx.fillText(designator, 0, 0);
      }
      
      // selection highlight
      const isSelected = selectedComponentIds.has(c.id);
      if (isSelected) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#00bfff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-half - 3, -half - 3, size + 6, size + 6);
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
          if ((stroke.type === 'via' || stroke.type === 'pad' || stroke.type === 'testPoint') && stroke.points.length > 0) {
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
        // Check if component is polarized using definition (single source of truth)
        const isPolarized = isComponentPolarized(comp) && comp.pinPolarities;
        
        // Check if this is a semiconductor (Transistor or Integrated Circuit in the Semiconductors category)
        const compDef = resolveComponentDefinition(comp as any);
        const isSemiconductor = compDef?.category === 'Semiconductors';
        
        // Collect unique node IDs with their polarity and Pin 1 info to avoid drawing duplicate lines
        // Map<nodeId, { isNegative: boolean, hasPin1: boolean }>
        // Note: hasPin1 is set for all semiconductors (Transistors and Integrated Circuits)
        const connectedNodes = new Map<string, { isNegative: boolean; hasPin1: boolean }>();
        for (let pinIndex = 0; pinIndex < pinConnections.length; pinIndex++) {
          const connection = pinConnections[pinIndex];
          if (connection && connection.trim() !== '') {
            const nodeIdStr = connection.trim();
            // Mark Pin 1 for all semiconductors (Transistors and Integrated Circuits)
            const isPin1 = isSemiconductor && pinIndex === 0;
            // Check if this pin is negative (for polarized components)
            const isNegative: boolean = Boolean(isPolarized && 
                             comp.pinPolarities && 
                             pinIndex < comp.pinPolarities.length &&
                             comp.pinPolarities[pinIndex] === '-');
            // If node already exists, keep the negative flag if either connection is negative
            // and keep hasPin1 if any connection is Pin 1 (for all semiconductors)
            const existingValue = connectedNodes.get(nodeIdStr);
            if (existingValue !== undefined) {
              connectedNodes.set(nodeIdStr, {
                isNegative: existingValue.isNegative || isNegative,
                hasPin1: existingValue.hasPin1 || isPin1
              });
            } else {
              connectedNodes.set(nodeIdStr, { isNegative, hasPin1: isPin1 });
            }
          }
        }
        
        // Draw one line per unique connected node, from component center to node center
        for (const [nodeIdStr, nodeInfo] of connectedNodes) {
          const { isNegative, hasPin1 } = nodeInfo;
          const nodePos = findNodeCoordinates(nodeIdStr);
          if (nodePos) {
            // Use component center as starting point
            const compCenter = { x: comp.x, y: comp.y };
            
            // Check if this connection is selected
            const pointId = parseInt(nodeIdStr, 10);
            const connectionKey = `${comp.id}:${pointId}`;
            const isSelected = selectedComponentConnections.has(connectionKey);
            
            ctx.save();
            // Use black for negative connections of polarized components
            // Use darkened color for Pin 1 connections (for all semiconductors: Transistors and Integrated Circuits)
            // hasPin1 is already set correctly for all semiconductors
            // Otherwise use component connection color
            // If selected, use highlight color (cyan) and thicker line
            if (isSelected) {
              ctx.strokeStyle = '#00bfff'; // Cyan highlight
              ctx.lineWidth = Math.max(2, (componentConnectionSize * 1.5) / Math.max(viewScale, 0.001));
              ctx.setLineDash([4, 3]);
            } else {
              if (isNegative) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
              } else if (hasPin1) {
                // Pin 1 gets a darker version of the component connection color
                // For all semiconductors (Transistors and Integrated Circuits)
                ctx.strokeStyle = darkenColor(componentConnectionColor, 0.4);
              } else {
                ctx.strokeStyle = componentConnectionColor;
              }
              ctx.lineWidth = Math.max(1, componentConnectionSize / Math.max(viewScale, 0.001));
            }
            ctx.beginPath();
            ctx.moveTo(compCenter.x, compCenter.y);
            ctx.lineTo(nodePos.x, nodePos.y);
            ctx.stroke();
            ctx.setLineDash([]);
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
    
    // Draw IC Placement preview rectangle
    if (isICPlacementMode && icPlacementArea) {
      ctx.save();
      const startWorld = icPlacementArea.start;
      const endWorld = icPlacementArea.end;
      // Draw in world coordinates (view transform already applied globally above)
      const minX = Math.min(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const maxY = Math.max(startWorld.y, endWorld.y);
      const width = maxX - minX;
      const height = maxY - minY;
      
      // Orange dashed rectangle with semi-transparent fill
      const dash = Math.max(2, 6 / Math.max(0.0001, viewScale));
      ctx.strokeStyle = '#ff8800';
      ctx.fillStyle = 'rgba(255, 136, 0, 0.2)';
      ctx.lineWidth = Math.max(1, 2 / Math.max(0.0001, viewScale));
      ctx.setLineDash([dash, dash]);
      ctx.beginPath();
      ctx.rect(minX, minY, width, height);
      ctx.fill();
      ctx.stroke();
      
      // Mark Pin 1 location (start point) with a small circle
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(startWorld.x, startWorld.y, Math.max(3, 6 / Math.max(0.0001, viewScale)), 0, Math.PI * 2);
      ctx.fill();
      
      ctx.setLineDash([]);
      ctx.restore();
    }
    
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
    
    // Draw coordinate axes at world origin (0, 0) AFTER view transform (if enabled)
    // This ensures axes rotate and flip with perspective changes
    // After the view transform (pan, scale, rotation, flip), the world origin (0,0) 
    // should already be positioned at the canvas center (when cameraWorldCenter = {x: 0, y: 0})
    if (showCrosshairs) {
    ctx.save();
    // Draw axes at world origin (0,0) - no additional translation needed
    // The view transform has already positioned the world origin correctly
    
    // Axes length and width - reduced for better appearance
    const axisLength = 50; // 50mm in world coordinates (world is 1000mm x 1000mm, so 1 unit = 1mm)
    const screenLineWidth = 2; // 2 pixels - thinner
    const lineWidthInWorld = screenLineWidth / viewScale;
    
    // Draw X axis (horizontal, symmetric about origin) in red
    ctx.strokeStyle = '#FF0000'; // Bright red
    ctx.lineWidth = lineWidthInWorld;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-axisLength, 0); // Start at negative X
    ctx.lineTo(axisLength, 0); // Draw to positive X (symmetric)
    ctx.stroke();
    
    // Label +X axis (positive direction)
    ctx.fillStyle = '#FF0000'; // Red text
    ctx.font = `${12 / viewScale}px sans-serif`; // Scale font with zoom
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('+X', axisLength + 2 / viewScale, 2 / viewScale);
    
    // Label -X axis (negative direction)
    ctx.textAlign = 'right';
    ctx.fillText('-X', -axisLength - 2 / viewScale, 2 / viewScale);
    
    // Draw Y axis (vertical, symmetric about origin) in blue
    ctx.strokeStyle = '#0000FF'; // Bright blue
    ctx.lineWidth = lineWidthInWorld;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -axisLength); // Start at negative Y
    ctx.lineTo(0, axisLength); // Draw to positive Y (symmetric)
    ctx.stroke();
    
    // Label +Y axis (positive direction)
    ctx.fillStyle = '#0000FF'; // Blue text
    ctx.font = `${12 / viewScale}px sans-serif`; // Scale font with zoom
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('+Y', 2 / viewScale, axisLength + 2 / viewScale);
    
    // Label -Y axis (negative direction)
    ctx.textBaseline = 'bottom';
    ctx.fillText('-Y', 2 / viewScale, -axisLength - 2 / viewScale);
    ctx.restore();
    }
    
    // Restore after view scaling
    ctx.restore();
  }, [topImage, bottomImage, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale, selectedImageForTransform, selectedDrawingLayer, viewScale, viewPan.x, viewPan.y, viewRotation, viewFlipX, showTopImage, showBottomImage, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopPadsLayer, showBottomPadsLayer, showTopTestPointsLayer, showBottomTestPointsLayer, showTopComponents, showBottomComponents, componentsTop, componentsBottom, showPowerLayer, powers, showGroundLayer, grounds, showConnectionsLayer, selectRect, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, flashObjectId, selectedComponentConnections, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, drawingMode, tracePreviewMousePos, areImagesLocked, componentConnectionColor, componentConnectionSize, showTraceCornerDots, showCrosshairs, cameraWorldCenter, isICPlacementMode, icPlacementArea]);


  // Responsive canvas sizing: fill available space while keeping 1.6:1 aspect ratio
  React.useEffect(() => {
    const computeSize = () => {
      const container = canvasContainerRef.current;
      if (!container) return;
      
      // ASPECT = width / height, so 1.6 means 1.6x wider than tall (e.g., 1600x1000)
      const ASPECT = 1.6;
      
      // The toolbar and layers panel are absolutely positioned INSIDE the container
      // Canvas starts at left: 244px (after Layers panel: 60 + 168 + 6 gap + 10px)
      // Leave some padding on the right
      const LEFT_OFFSET = 244; // Canvas left position
      const RIGHT_PADDING = 12; // Right padding
      const CANVAS_TOP = 6; // Canvas top position
      const VERTICAL_PADDING = 12; // Top/bottom padding (6px top + 6px bottom)
      const availableW = container.clientWidth - LEFT_OFFSET - RIGHT_PADDING;
      
      // Calculate available height accounting for viewport limits
      // Get container's position relative to viewport
      const containerRect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const containerTop = containerRect.top;
      const BOTTOM_MARGIN = 10; // Keep 10 pixels above bottom of browser window
      const maxHeightFromViewport = viewportHeight - containerTop - CANVAS_TOP - BOTTOM_MARGIN;
      const availableH = Math.min(container.clientHeight - VERTICAL_PADDING, maxHeightFromViewport);
      
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
      
      // Reduce height by 20 pixels (keep top position unchanged)
      height = Math.max(355, height - 20);
      
      setCanvasSize(prev => {
        const isFirstSize = prev.width === 0 && prev.height === 0;
        const sizeChanged = prev.width !== width || prev.height !== height;
        
        // If this is the first time setting canvas size, ensure origin is centered
        if (isFirstSize && sizeChanged) {
          // Use a small delay to ensure the canvas ref is updated
          setTimeout(() => {
            setCameraWorldCenter({ x: 0, y: 0 });
          }, 0);
        }
        
        // The viewPan will be recalculated automatically from cameraWorldCenter via useMemo
        // So we don't need to adjust it here - just let it recalculate
        return (prev.width === width && prev.height === height) ? prev : { width, height };
      });
    };
    computeSize();
    window.addEventListener('resize', computeSize);
    return () => window.removeEventListener('resize', computeSize);
  }, [setViewPan, setCameraWorldCenter]);

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
    // Helper to draw a pronounced highlight for the last "found" object
    const drawFlashHighlight = (id: string, x: number, y: number, size: number, shape: 'circle' | 'square' | 'diamond' = 'circle') => {
      if (flashObjectId === id) {
        ctx.save();
        ctx.strokeStyle = '#ffff00'; // Bright yellow
        ctx.lineWidth = 4 / viewScale;
        ctx.setLineDash([]);
        const r = (size / 2) + (6 / viewScale);
        
        ctx.beginPath();
        if (shape === 'circle') {
          ctx.arc(x, y, r, 0, TWO_PI);
        } else if (shape === 'square') {
          ctx.rect(x - r, y - r, r * 2, r * 2);
        } else if (shape === 'diamond') {
          ctx.moveTo(x, y - r);
          ctx.lineTo(x + r, y);
          ctx.lineTo(x, y + r);
          ctx.lineTo(x - r, y);
          ctx.closePath();
        }
        ctx.stroke();
        
        // Outer glow
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 8 / viewScale;
        ctx.stroke();
        
        ctx.restore();
      }
    };

    // Pass 1: draw traces first (so vias, pads, and test points appear on top)
    // IMPORTANT: Skip vias, pads, and test points here - they are drawn in Pass 2 with their own visibility controls
    drawingStrokes.forEach(stroke => {
      // Explicitly skip vias, pads, and test points - they are drawn in Pass 2
      // Check for test points by type property AND by testPointType property to be defensive
      if (stroke.type === 'via' || stroke.type === 'pad' || stroke.type === 'testPoint' || (stroke as any).testPointType !== undefined) return;
      // Only draw traces in Pass 1 - check that it's actually a trace
      if (stroke.type !== 'trace') return;
      let shouldShowStroke = false;
      if (stroke.layer === 'top') shouldShowStroke = showTopTracesLayer;
      else if (stroke.layer === 'bottom') shouldShowStroke = showBottomTracesLayer;
      if (!shouldShowStroke) return;

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        const r = Math.max(0.5, stroke.size / 2);
        
        // Draw flash highlight if this is the "found" object
        drawFlashHighlight(stroke.id, p.x, p.y, stroke.size);

        if (selectedIds.has(stroke.id)) {
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3, 0, TWO_PI);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TWO_PI);
        ctx.fill();
      } else {
        // Draw flash highlight for traces (use first point as anchor)
        if (stroke.points.length > 0) {
          drawFlashHighlight(stroke.id, stroke.points[0].x, stroke.points[0].y, stroke.size);
        }

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

        // Draw dots at vertices (optional - separate control for corners vs endpoints)
          ctx.fillStyle = '#000000';
        const numPoints = stroke.points.length;
        for (let i = 0; i < numPoints; i++) {
          const pt = stroke.points[i];
          const isEndPoint = (i === 0 || i === numPoints - 1);
          const isCornerPoint = !isEndPoint;
          
          // Draw based on settings: end dots for first/last, corner dots for middle points
          if ((isEndPoint && showTraceEndDots) || (isCornerPoint && showTraceCornerDots)) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, stroke.size / 2, 0, TWO_PI);
            ctx.fill();
          }
        }
      }
    });

    // Pass 2: draw vias, pads, and test points on top of traces
    // IMPORTANT: Each type uses ONLY its own visibility flags - no cross-contamination
    drawingStrokes.forEach(stroke => {
      if (stroke.type === 'via') {
        // Vias use ONLY showViasLayer - not affected by trace, pad, or test point flags
        if (!showViasLayer) return;
      } else if (stroke.type === 'pad') {
        // Pads use ONLY pad visibility flags - not affected by trace, via, or test point flags
        const padLayer = stroke.layer || 'top';
        if (padLayer === 'top' && !showTopPadsLayer) return;
        if (padLayer === 'bottom' && !showBottomPadsLayer) return;
      } else if (stroke.type === 'testPoint') {
        // Test points use ONLY test point visibility flags - not affected by trace, pad, or via flags
        const testPointLayer = stroke.layer || 'top';
        if (testPointLayer === 'top' && !showTopTestPointsLayer) return;
        if (testPointLayer === 'bottom' && !showBottomTestPointsLayer) return;
      } else {
        // Not a via, pad, or test point - skip (traces are drawn in Pass 1)
        return;
      }
      const c = stroke.points[0];
      
      // Draw flash highlight
      drawFlashHighlight(
        stroke.id, 
        c.x, 
        c.y, 
        stroke.size, 
        stroke.type === 'pad' ? 'square' : stroke.type === 'testPoint' ? 'diamond' : 'circle'
      );

      // Selection highlight
      if (selectedIds.has(stroke.id)) {
        if (stroke.type === 'via') {
          const rOuter = Math.max(0.5, stroke.size / 2) + 3;
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(c.x, c.y, rOuter, 0, TWO_PI);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (stroke.type === 'pad') {
          const halfSize = Math.max(0.5, stroke.size / 2) + 3;
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(c.x - halfSize, c.y - halfSize, stroke.size + 6, stroke.size + 6);
          ctx.setLineDash([]);
        } else if (stroke.type === 'testPoint') {
          const halfSize = Math.max(0.5, stroke.size / 2) + 3;
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - halfSize); // Top
          ctx.lineTo(c.x + halfSize, c.y); // Right
          ctx.lineTo(c.x, c.y + halfSize); // Bottom
          ctx.lineTo(c.x - halfSize, c.y); // Left
          ctx.closePath();
          ctx.stroke();
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
        ctx.arc(c.x, c.y, rOuter, 0, TWO_PI);
        // Inner circle (creates the hole with even-odd fill rule)
        ctx.arc(c.x, c.y, rInner, 0, TWO_PI);
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
      } else if (stroke.type === 'testPoint') {
        // Draw test point as bright yellow-filled diamond shape with black outline
        const halfSize = Math.max(0.5, stroke.size / 2);
        const crosshairLength = halfSize * 0.7;
        
        // Draw bright yellow-filled diamond with black border
        ctx.fillStyle = stroke.color || '#FFFF00'; // Use stroke color or bright yellow default
        ctx.strokeStyle = '#000000'; // Always black outline
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - halfSize); // Top
        ctx.lineTo(c.x + halfSize, c.y); // Right
        ctx.lineTo(c.x, c.y + halfSize); // Bottom
        ctx.lineTo(c.x - halfSize, c.y); // Left
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Draw black outline
        
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
            ctx.arc(center.x, center.y, rOuter, 0, TWO_PI);
            // Inner circle (creates the hole with even-odd fill rule)
            ctx.arc(center.x, center.y, rInner, 0, TWO_PI);
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
          } else if (drawingMode === 'testPoint') {
            const center = currentStroke[currentStroke.length - 1];
            const halfSize = Math.max(0.5, brushSize / 2);
            const crosshairLength = halfSize * 0.7;
            
            // Draw white-filled diamond shape
            ctx.fillStyle = brushColor;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y - halfSize); // Top
            ctx.lineTo(center.x + halfSize, center.y); // Right
            ctx.lineTo(center.x, center.y + halfSize); // Bottom
            ctx.lineTo(center.x - halfSize, center.y); // Left
            ctx.closePath();
            ctx.fill();
            
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
              ctx.arc(p.x, p.y, r, 0, TWO_PI);
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
  }, [drawingStrokes, selectedIds, showTopTracesLayer, showBottomTracesLayer, showViasLayer, showTopPadsLayer, showBottomPadsLayer, showTopTestPointsLayer, showBottomTestPointsLayer, currentStroke, currentTool, drawingMode, brushColor, brushSize, selectedDrawingLayer, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, tracePreviewMousePos, showTraceCornerDots, showTraceEndDots]);

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
    // Reset BOTH images to their original transform (when loaded)
    const defaultTransform = {
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
      brightness: 100,
      contrast: 100,
    };
    
    // Reset top image if it exists
    if (topImage) {
      setTopImage(prev => prev ? { ...prev, ...defaultTransform } : null);
    }
    
    // Reset bottom image if it exists
    if (bottomImage) {
      setBottomImage(prev => prev ? { ...prev, ...defaultTransform } : null);
    }
    
    // Also restore color mode (global)
    setIsGrayscale(false);
  }, [topImage, bottomImage, setTopImage, setBottomImage]);

  // Enhanced keyboard functionality for sliders, drawing undo, and image transformation
  // Helper functions for size changes
  const increaseSize = useCallback((increment: number = 1) => {
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
          const newSize = s.size + increment;
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
        const newSize = (selectedComponentIds.size > 0 ? (componentsTop.find(c => selectedComponentIds.has(c.id))?.size || 18) : 18) + increment;
        saveDefaultSize('component', newSize);
        setComponentsTop(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: (c.size || 18) + increment } : c));
        setComponentsBottom(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: (c.size || 18) + increment } : c));
      }
      if (selectedPowerIds.size > 0) {
        const newSize = (powers.find(p => selectedPowerIds.has(p.id))?.size || 18) + increment;
        saveDefaultSize('power', newSize);
        setPowerSymbols(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: p.size + increment } : p));
      }
      if (selectedGroundIds.size > 0) {
        const newSize = (grounds.find(g => selectedGroundIds.has(g.id))?.size || 18) + increment;
        saveDefaultSize('ground', newSize);
        setGroundSymbols(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: (g.size || 18) + increment } : g));
      }
    } else {
      // Update tool size using centralized tool state management
      // Use refs as source of truth (updated synchronously in layer chooser buttons)
      // to avoid stale state from async React state updates
      let toolInstanceId: ToolInstanceId | null = null;
      if (currentTool === 'draw' && drawingMode === 'via') {
        toolInstanceId = 'via';
      } else if (currentTool === 'draw' && drawingMode === 'pad') {
        // Use ref for immediate synchronous access to current layer
        const layer = padToolLayerRef.current;
        toolInstanceId = layer === 'bottom' ? 'padBottom' : 'padTop';
      } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
        // Use ref for immediate synchronous access to current layer
        const layer = testPointToolLayerRef.current;
        toolInstanceId = layer === 'bottom' ? 'testPointBottom' : 'testPointTop';
      } else if (currentTool === 'draw' && drawingMode === 'trace') {
        // Use ref for immediate synchronous access to current layer
        const layer = traceToolLayerRef.current;
        toolInstanceId = layer === 'bottom' ? 'traceBottom' : 'traceTop';
      } else if (currentTool === 'component') {
        // Use ref for immediate synchronous access to current layer
        const layer = componentToolLayerRef.current;
        toolInstanceId = layer === 'bottom' ? 'componentBottom' : 'componentTop';
      } else if (currentTool === 'power') {
        toolInstanceId = 'power';
      } else if (currentTool === 'ground') {
        toolInstanceId = 'ground';
      }
      
      if (toolInstanceId) {
        // Read current size directly from tool instance (source of truth) to avoid stale closure values
        const currentInstance = toolInstanceManager.get(toolInstanceId);
        const newSize = Math.min(40, currentInstance.size + increment);
        toolInstanceManager.setSize(toolInstanceId, newSize);
        // brushSize will be synced automatically via useEffect
      }
    }
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, areTracesLocked, arePadsLocked, areTestPointsLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked, currentTool, drawingMode, saveDefaultSize]);

  const decreaseSize = useCallback((decrement: number = 1) => {
    if (selectedIds.size > 0 || selectedComponentIds.size > 0 || selectedPowerIds.size > 0 || selectedGroundIds.size > 0) {
      // Check if any selected items are locked
      if (selectedIds.size > 0) {
        const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
        const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
        const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
        const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
        const hasLockedTestPoints = areTestPointsLocked && selectedStrokes.some(s => s.type === 'testPoint');
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
        if (hasLockedTestPoints) {
          alert('Cannot change size: Test Points are locked. Unlock test points to change their size.');
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
          const newSize = Math.max(1, s.size - decrement);
          // Persist default size for this object type
          if (s.type === 'via') {
            saveDefaultSize('via', newSize);
          } else if (s.type === 'pad') {
            saveDefaultSize('pad', newSize, s.layer);
          } else if (s.type === 'testPoint') {
            saveDefaultSize('testPoint', newSize, s.layer);
          } else if (s.type === 'trace') {
            saveDefaultSize('trace', newSize, s.layer);
          }
          return { ...s, size: newSize };
        }
        return s;
      }));
      if (selectedComponentIds.size > 0) {
        const newSize = Math.max(12, (selectedComponentIds.size > 0 ? (componentsTop.find(c => selectedComponentIds.has(c.id))?.size || 18) : 18) - decrement);
        saveDefaultSize('component', newSize);
        setComponentsTop(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: Math.max(12, (c.size || 18) - decrement) } : c));
        setComponentsBottom(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: Math.max(12, (c.size || 18) - decrement) } : c));
      }
      if (selectedPowerIds.size > 0) {
        const newSize = Math.max(12, (powers.find(p => selectedPowerIds.has(p.id))?.size || 18) - decrement);
        saveDefaultSize('power', newSize);
        setPowerSymbols(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: Math.max(12, p.size - decrement) } : p));
      }
      if (selectedGroundIds.size > 0) {
        const newSize = Math.max(12, (grounds.find(g => selectedGroundIds.has(g.id))?.size || 18) - decrement);
        saveDefaultSize('ground', newSize);
        setGroundSymbols(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: Math.max(12, (g.size || 18) - decrement) } : g));
      }
    } else {
      // Update tool size using centralized tool state management
      // Use selectedDrawingLayer as source of truth (set synchronously in layer chooser buttons)
      // to avoid stale state from async React state updates
      let toolInstanceId: ToolInstanceId | null = null;
      if (currentTool === 'draw' && drawingMode === 'via') {
        toolInstanceId = 'via';
      } else if (currentTool === 'draw' && drawingMode === 'pad') {
        // Use selectedDrawingLayer as source of truth, fallback to padToolLayer if not set
        const layer = selectedDrawingLayer || padToolLayer || 'top';
        toolInstanceId = layer === 'bottom' ? 'padBottom' : 'padTop';
      } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
        // Use selectedDrawingLayer as source of truth, fallback to testPointToolLayer if not set
        const layer = selectedDrawingLayer || testPointToolLayer || 'top';
        toolInstanceId = layer === 'bottom' ? 'testPointBottom' : 'testPointTop';
      } else if (currentTool === 'draw' && drawingMode === 'trace') {
        // Use selectedDrawingLayer as source of truth, fallback to traceToolLayer if not set
        const layer = selectedDrawingLayer || traceToolLayer || 'top';
        toolInstanceId = layer === 'bottom' ? 'traceBottom' : 'traceTop';
      } else if (currentTool === 'component') {
        // Use selectedDrawingLayer as source of truth, fallback to componentToolLayer if not set
        const layer = selectedDrawingLayer || componentToolLayer || 'top';
        toolInstanceId = layer === 'bottom' ? 'componentBottom' : 'componentTop';
      } else if (currentTool === 'power') {
        toolInstanceId = 'power';
      } else if (currentTool === 'ground') {
        toolInstanceId = 'ground';
      }
      
      if (toolInstanceId) {
        // Read current size directly from tool instance (source of truth) to avoid stale closure values
        const currentInstance = toolInstanceManager.get(toolInstanceId);
        const newSize = Math.max(1, currentInstance.size - decrement);
        toolInstanceManager.setSize(toolInstanceId, newSize);
        // brushSize will be synced automatically via useEffect
      }
    }
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, areTracesLocked, arePadsLocked, areTestPointsLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked, currentTool, drawingMode, selectedDrawingLayer, padToolLayer, testPointToolLayer, traceToolLayer, componentToolLayer, saveDefaultSize]);

  // Open Change Size dialog
  const handleOpenChangeSize = useCallback(() => {
    // Get the current size of the first selected object
    let currentSize = 10; // default
    
    if (selectedIds.size > 0) {
      const firstId = selectedIds.values().next().value;
      const stroke = drawingStrokes.find(s => s.id === firstId);
      if (stroke) currentSize = stroke.size;
    } else if (selectedComponentIds.size > 0) {
      const firstId = selectedComponentIds.values().next().value;
      const comp = componentsTop.find(c => c.id === firstId) || componentsBottom.find(c => c.id === firstId);
      if (comp) currentSize = comp.size || 18;
    } else if (selectedPowerIds.size > 0) {
      const firstId = selectedPowerIds.values().next().value;
      const power = powers.find(p => p.id === firstId);
      if (power) currentSize = power.size;
    } else if (selectedGroundIds.size > 0) {
      const firstId = selectedGroundIds.values().next().value;
      const ground = grounds.find(g => g.id === firstId);
      if (ground) currentSize = ground.size;
    }
    
    setChangeSizeDialog({ visible: true, size: currentSize });
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds]);

  // Open Change Color dialog
  const handleOpenChangeColor = useCallback(() => {
    // Get the current color of the first selected object
    let currentColor = '#ff0000'; // default
    
    if (selectedIds.size > 0) {
      const firstId = selectedIds.values().next().value;
      const stroke = drawingStrokes.find(s => s.id === firstId);
      if (stroke) currentColor = stroke.color;
    } else if (selectedComponentIds.size > 0) {
      const firstId = selectedComponentIds.values().next().value;
      const comp = componentsTop.find(c => c.id === firstId) || componentsBottom.find(c => c.id === firstId);
      if (comp) currentColor = comp.color;
    } else if (selectedPowerIds.size > 0) {
      const firstId = selectedPowerIds.values().next().value;
      const power = powers.find(p => p.id === firstId);
      if (power) currentColor = power.color;
    } else if (selectedGroundIds.size > 0) {
      const firstId = selectedGroundIds.values().next().value;
      const ground = grounds.find(g => g.id === firstId);
      if (ground) currentColor = ground.color;
    }
    
    setChangeColorDialog({ visible: true, color: currentColor });
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds]);

  // Apply size from Change Size dialog
  const handleApplyChangeSize = useCallback(() => {
    const newSize = changeSizeDialog.size;
    
    if (selectedIds.size === 0 && selectedComponentIds.size === 0 && selectedPowerIds.size === 0 && selectedGroundIds.size === 0) {
      alert('No objects selected. Please select objects first.');
      setChangeSizeDialog({ visible: false, size: 10 });
      return;
    }
    
    // Check for locked items
    if (selectedIds.size > 0) {
      const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
      const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
      const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
      const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
      const hasLockedTestPoints = areTestPointsLocked && selectedStrokes.some(s => s.type === 'testPoint');
      if (hasLockedVias || hasLockedPads || hasLockedTraces || hasLockedTestPoints) {
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
    
    // Apply the size to all selected objects
    if (selectedIds.size > 0) {
      setDrawingStrokes(prev => prev.map(s => 
        selectedIds.has(s.id) ? { ...s, size: newSize } : s
      ));
    }
    if (selectedComponentIds.size > 0) {
      setComponentsTop(prev => prev.map(c => 
        selectedComponentIds.has(c.id) ? { ...c, size: newSize } : c
      ));
      setComponentsBottom(prev => prev.map(c => 
        selectedComponentIds.has(c.id) ? { ...c, size: newSize } : c
      ));
    }
    if (selectedPowerIds.size > 0) {
      setPowerSymbols(prev => prev.map(p => 
        selectedPowerIds.has(p.id) ? { ...p, size: newSize } : p
      ));
    }
    if (selectedGroundIds.size > 0) {
      setGroundSymbols(prev => prev.map(g => 
        selectedGroundIds.has(g.id) ? { ...g, size: newSize } : g
      ));
    }
    
    setChangeSizeDialog({ visible: false, size: 10 });
  }, [changeSizeDialog.size, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, arePadsLocked, areTracesLocked, areTestPointsLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked]);

  // Apply color from Change Color dialog
  const handleApplyChangeColor = useCallback(() => {
    const newColor = changeColorDialog.color;
    
    if (selectedIds.size === 0 && selectedComponentIds.size === 0 && selectedPowerIds.size === 0 && selectedGroundIds.size === 0) {
      alert('No objects selected. Please select objects first.');
      setChangeColorDialog({ visible: false, color: '#ff0000' });
      return;
    }
    
    // Check for locked items
    if (selectedIds.size > 0) {
      const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
      const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
      const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
      const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
      const hasLockedTestPoints = areTestPointsLocked && selectedStrokes.some(s => s.type === 'testPoint');
      if (hasLockedVias || hasLockedPads || hasLockedTraces || hasLockedTestPoints) {
        alert('Cannot change color: selected items are locked.');
        return;
      }
    }
    if (selectedComponentIds.size > 0 && areComponentsLocked) {
      alert('Cannot change color: selected components are locked.');
      return;
    }
    if (selectedPowerIds.size > 0 && arePowerNodesLocked) {
      alert('Cannot change color: selected power nodes are locked.');
      return;
    }
    if (selectedGroundIds.size > 0 && areGroundNodesLocked) {
      alert('Cannot change color: selected ground nodes are locked.');
      return;
    }
    
    // Apply the color to all selected objects
    if (selectedIds.size > 0) {
      setDrawingStrokes(prev => prev.map(s => 
        selectedIds.has(s.id) ? { ...s, color: newColor } : s
      ));
    }
    if (selectedComponentIds.size > 0) {
      setComponentsTop(prev => prev.map(c => 
        selectedComponentIds.has(c.id) ? { ...c, color: newColor } : c
      ));
      setComponentsBottom(prev => prev.map(c => 
        selectedComponentIds.has(c.id) ? { ...c, color: newColor } : c
      ));
    }
    if (selectedPowerIds.size > 0) {
      setPowerSymbols(prev => prev.map(p => 
        selectedPowerIds.has(p.id) ? { ...p, color: newColor } : p
      ));
    }
    if (selectedGroundIds.size > 0) {
      setGroundSymbols(prev => prev.map(g => 
        selectedGroundIds.has(g.id) ? { ...g, color: newColor } : g
      ));
    }
    
    setChangeColorDialog({ visible: false, color: '#ff0000' });
  }, [changeColorDialog.color, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, arePadsLocked, areTracesLocked, areTestPointsLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked]);

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
        const hasLockedTestPoints = areTestPointsLocked && selectedStrokes.some(s => s.type === 'testPoint');
        if (hasLockedVias || hasLockedPads || hasLockedTraces || hasLockedTestPoints) {
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
            saveDefaultSize('pad', sz, s.layer);
            // Update toolRegistry
            setToolRegistry(prev => {
              const updated = new Map(prev);
              const padDef = updated.get('pad');
              if (padDef) {
                const layerSettings = new Map(padDef.layerSettings);
                layerSettings.set(s.layer, { ...layerSettings.get(s.layer) || { color: padDef.settings.color, size: sz }, size: sz });
                updated.set('pad', { ...padDef, layerSettings });
              }
              return updated;
            });
          } else if (s.type === 'testPoint') {
            saveDefaultSize('testPoint', sz, s.layer);
            // Update toolRegistry
            setToolRegistry(prev => {
              const updated = new Map(prev);
              const testPointDef = updated.get('testPoint');
              if (testPointDef) {
                const layerSettings = new Map(testPointDef.layerSettings);
                layerSettings.set(s.layer, { ...layerSettings.get(s.layer) || { color: testPointDef.settings.color, size: sz }, size: sz });
                updated.set('testPoint', { ...testPointDef, layerSettings });
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
      // Also update layer defaults for consistent behavior
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
        saveDefaultSize('pad', sz, selectedDrawingLayer);
      } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
        saveDefaultSize('testPoint', sz, selectedDrawingLayer);
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
    await configureAutoSave(
      interval,
      projectName,
      projectDirHandle,
      setAutoSaveEnabled,
      setAutoSaveInterval,
      setAutoSaveDirHandle,
      setAutoSaveBaseName,
      autoSaveDirHandleRef,
      autoSaveBaseNameRef,
      autoSaveIntervalRef,
      hasChangesSinceLastAutoSaveRef,
      setAutoSaveDialog,
      setAutoSavePromptDialog,
      setProjectDirHandle,
      performAutoSaveRef,
      closePromptDialog
    );
  }, [projectName, projectDirHandle, setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveDirHandle, setAutoSaveBaseName, autoSaveDirHandleRef, autoSaveBaseNameRef, autoSaveIntervalRef, hasChangesSinceLastAutoSaveRef, setAutoSaveDialog, setAutoSavePromptDialog, setProjectDirHandle, performAutoSaveRef]);

  // Helper function to switch to Select tool and deselect all icons
  const switchToSelectTool = useCallback(() => {
    clearAllSelections(); // Clear all selections when tool is selected
    setCurrentTool('select');
  }, [clearAllSelections]);

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
    
    // In read-only mode (viewing file history), only allow Magnify (M key) shortcut
    // Check currentFileIndexRef to get the latest value without causing re-renders
    const isReadOnly = currentFileIndexRef.current > 0;
    
    // Allow Magnify (M key) even in read-only mode
    if (isReadOnly && (e.key !== 'm' && e.key !== 'M')) {
      // Block all other shortcuts in read-only mode
      return;
    }
    
    // Number keys (0-9): Handle home view setting/recall
    const numKey = parseInt(e.key);
    if (!isNaN(numKey) && numKey >= 0 && numKey <= 9) {
      e.preventDefault();
      e.stopPropagation();
      
      // If center tool is active and waiting for a number key, save current view to that slot
      if (currentTool === 'center' && isWaitingForHomeViewKey) {
        // Clear the timeout
        if (homeViewTimeoutRef.current) {
          clearTimeout(homeViewTimeoutRef.current);
          homeViewTimeoutRef.current = null;
        }
        
        // Save current PCB position - use top image center as reference (or bottom image if no top image)
        // Since camera is fixed at (0,0), we save where the PCB objects are positioned
        const canvas = canvasRef.current;
        if (canvas) {
          // Use top image center as reference point (or bottom image if no top image)
          let pcbRefX = 0;
          let pcbRefY = 0;
          if (topImage) {
            pcbRefX = topImage.x;
            pcbRefY = topImage.y;
          } else if (bottomImage) {
            pcbRefX = bottomImage.x;
            pcbRefY = bottomImage.y;
          }
          // If no images, use (0,0) as reference
          
          // Save the view to the specified slot (including all layer visibility settings and view state)
          setHomeViews(prev => ({
            ...prev,
            [numKey]: {
              pcbReferenceX: pcbRefX,
              pcbReferenceY: pcbRefY,
              // Save camera position for view panning (e.g., from Magnify tool)
              cameraWorldCenterX: cameraWorldCenter.x,
              cameraWorldCenterY: cameraWorldCenter.y,
              // Legacy fields for backward compatibility (always 0,0 since camera is fixed)
              x: 0,
              y: 0,
              zoom: viewScale,
              viewRotation,
              viewFlipX,
              isBottomView,
              transparency,
              showTopImage,
              showBottomImage,
              showViasLayer,
              showTopTracesLayer,
              showBottomTracesLayer,
              showTopPadsLayer,
              showBottomPadsLayer,
              showTopTestPointsLayer,
              showBottomTestPointsLayer,
              showTopComponents,
              showBottomComponents,
              showPowerLayer,
              showGroundLayer,
              showConnectionsLayer,
            }
          }));
        }
        
        // Reset state and return to select tool
        setIsWaitingForHomeViewKey(false);
        setCurrentTool('select');
        setCanvasCursor(undefined);
        return;
      }
      
      // If not in center tool mode, recall the home view for this number (if it exists)
      const homeView = homeViews[numKey];
      if (homeView) {
        // Restore zoom and view perspective state first
        setViewScale(homeView.zoom);
        setViewRotation(homeView.viewRotation ?? 0);
        setViewFlipX(homeView.viewFlipX ?? false);
        setIsBottomView(homeView.isBottomView ?? false);
        setTransparency(homeView.transparency ?? 50);
        
        // Restore PCB position by moving all objects so the reference point is back at saved position
        // Use new format (pcbReferenceX/Y) if available, otherwise fall back to legacy (x/y)
        const savedRefX = homeView.pcbReferenceX ?? homeView.x ?? 0;
        const savedRefY = homeView.pcbReferenceY ?? homeView.y ?? 0;
        
        // Calculate current reference point (top image center, or bottom if no top, or 0,0 if no images)
        let currentRefX = 0;
        let currentRefY = 0;
        if (topImage) {
          currentRefX = topImage.x;
          currentRefY = topImage.y;
        } else if (bottomImage) {
          currentRefX = bottomImage.x;
          currentRefY = bottomImage.y;
        }
        
        // Calculate delta needed to move PCB back to saved position
        const deltaX = savedRefX - currentRefX;
        const deltaY = savedRefY - currentRefY;
        
        // Move all objects by the delta (same as Hand tool does)
        if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
          // Move images
          if (topImage) {
            setTopImage({ ...topImage, x: topImage.x + deltaX, y: topImage.y + deltaY });
          }
          if (bottomImage) {
            setBottomImage({ ...bottomImage, x: bottomImage.x + deltaX, y: bottomImage.y + deltaY });
          }
          
          // Move components
          setComponentsTop(componentsTop.map(comp => ({
            ...comp,
            x: comp.x + deltaX,
            y: comp.y + deltaY
          })));
          setComponentsBottom(componentsBottom.map(comp => ({
            ...comp,
            x: comp.x + deltaX,
            y: comp.y + deltaY
          })));
          
          // Move power symbols
          setPowerSymbols(powerSymbols.map(p => ({
            ...p,
            x: p.x + deltaX,
            y: p.y + deltaY
          })));
          
          // Move ground symbols
          setGroundSymbols(groundSymbols.map(g => ({
            ...g,
            x: g.x + deltaX,
            y: g.y + deltaY
          })));
          
          // Move drawing strokes (all points in each stroke)
          setDrawingStrokes(drawingStrokes.map(stroke => ({
            ...stroke,
            points: stroke.points.map(point => ({
              ...point,
              x: point.x + deltaX,
              y: point.y + deltaY
            }))
          })));
          
          // Move current stroke (active drawing in progress) if it has points
          if (currentStroke.length > 0) {
            setCurrentStroke(currentStroke.map(point => ({
              ...point,
              x: point.x + deltaX,
              y: point.y + deltaY
            })));
          }
          
          // Move vias
          setVias(vias.map(via => ({
            ...via,
            x: via.x + deltaX,
            y: via.y + deltaY
          })));
          
          // Move pads
          setPads(pads.map(pad => ({
            ...pad,
            x: pad.x + deltaX,
            y: pad.y + deltaY
          })));
        }
        
        // Restore camera position (for view panning from Magnify tool)
        // Default to (0,0) for backward compatibility with old saved views
        const savedCameraX = homeView.cameraWorldCenterX ?? 0;
        const savedCameraY = homeView.cameraWorldCenterY ?? 0;
        setCameraWorldCenter({ x: savedCameraX, y: savedCameraY });
        
        // Restore all layer visibility settings
        setShowTopImage(homeView.showTopImage);
        setShowBottomImage(homeView.showBottomImage);
        setShowViasLayer(homeView.showViasLayer);
        setShowTopTracesLayer(homeView.showTopTracesLayer);
        setShowBottomTracesLayer(homeView.showBottomTracesLayer);
        setShowTopPadsLayer(homeView.showTopPadsLayer);
        setShowBottomPadsLayer(homeView.showBottomPadsLayer);
        setShowTopTestPointsLayer(homeView.showTopTestPointsLayer);
        setShowBottomTestPointsLayer(homeView.showBottomTestPointsLayer);
        setShowTopComponents(homeView.showTopComponents);
        setShowBottomComponents(homeView.showBottomComponents);
        setShowPowerLayer(homeView.showPowerLayer);
        setShowGroundLayer(homeView.showGroundLayer);
        setShowConnectionsLayer(homeView.showConnectionsLayer);
      }
      return;
    }
    
    // Size change shortcuts: + and - keys
    if (e.key === '+' || e.key === '=') {
      // + key (or = key on keyboards where + requires Shift)
      e.preventDefault();
      e.stopPropagation();
      increaseSize(e.shiftKey ? 5 : 1);
      return;
    }
    if (e.key === '-' || e.key === '_') {
      // - key (or _ key on keyboards where - requires Shift)
      e.preventDefault();
      e.stopPropagation();
      decreaseSize(e.shiftKey ? 5 : 1);
      return;
    }
    
    // Arrow keys: Handle perspective controls and component movement
    // Check if Shift is pressed or Caps Lock is on (for perspective changes)
    const isShiftOrCapsLock = e.shiftKey || e.getModifierState('CapsLock');
    
    // Check if we're in transform mode with an image selected (for image transformations)
    const isTransformModeWithImage = currentTool === 'transform' && selectedImageForTransform;
    
    // Handle arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Priority 1: Component movement (when components are selected - takes precedence over perspective)
      if (selectedComponentIds.size > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        // Movement step size (in world coordinates)
        // Shift key = larger steps (10 units), otherwise 1 unit
        const stepSize = e.shiftKey ? 10 : 1;
        
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
      
      // Priority 2: Perspective controls (when Shift/Caps Lock is pressed and NOT in transform mode with image)
      // Only trigger if no components are selected (components take priority)
      if (isShiftOrCapsLock && !isTransformModeWithImage && selectedComponentIds.size === 0) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          // Rotate perspective: Up = counter-clockwise (-90°), Down = clockwise (+90°)
          e.preventDefault();
          e.stopPropagation();
          const angle = e.key === 'ArrowUp' ? -90 : 90;
          rotatePerspective(angle);
          return;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          // Switch perspective (top/bottom view)
          e.preventDefault();
          e.stopPropagation();
          switchPerspective();
          return;
        }
      }
      
      // Priority 3: Image transformations (when in transform mode with image selected)
      // This is handled later in the code for transform mode
    }
    
    // Detailed Information: Display properties of selected objects (I)
    if (e.key === 'I' || e.key === 'i') {
      if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Ignore if user is typing in an input field, textarea, or contenteditable
        const active = document.activeElement as HTMLElement | null;
        const isEditing =
          !!active &&
          ((active.tagName === 'INPUT' && 
            (active as HTMLInputElement).type !== 'range' &&
            (active as HTMLInputElement).type !== 'checkbox' &&
            (active as HTMLInputElement).type !== 'radio') ||
           active.tagName === 'TEXTAREA' ||
           active.isContentEditable);
        if (isEditing) return;
        
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
    
    // Notes Dialog: Open notes editor for selected objects (N)
    if (e.key === 'N' || e.key === 'n') {
      if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Ignore if user is typing in an input field, textarea, or contenteditable
        const active = document.activeElement as HTMLElement | null;
        const isEditing =
          !!active &&
          ((active.tagName === 'INPUT' && 
            (active as HTMLInputElement).type !== 'range' &&
            (active as HTMLInputElement).type !== 'checkbox' &&
            (active as HTMLInputElement).type !== 'radio') ||
           active.tagName === 'TEXTAREA' ||
           active.isContentEditable);
        if (isEditing) return;
        
        e.preventDefault();
        e.stopPropagation();
        setNotesDialogVisible(true);
        return;
      }
    }
    
    // Project Notes Dialog: Open project notes / TODO list (L)
    if (e.key === 'L' || e.key === 'l') {
      if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Ignore if user is typing in an input field, textarea, or contenteditable
        const active = document.activeElement as HTMLElement | null;
        const isEditing =
          !!active &&
          ((active.tagName === 'INPUT' && 
            (active as HTMLInputElement).type !== 'range' &&
            (active as HTMLInputElement).type !== 'checkbox' &&
            (active as HTMLInputElement).type !== 'radio') ||
           active.tagName === 'TEXTAREA' ||
           active.isContentEditable);
        if (isEditing) return;
        
        e.preventDefault();
        e.stopPropagation();
        setProjectNotesDialogVisible(true);
        return;
      }
    }
    
    // Change Perspective Dialog: Open Tools -> Change Perspective dialog (E)
    if (e.key === 'E' || e.key === 'e') {
      if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Ignore if user is typing in an input field, textarea, or contenteditable
        const active = document.activeElement as HTMLElement | null;
        const isEditing =
          !!active &&
          ((active.tagName === 'INPUT' && 
            (active as HTMLInputElement).type !== 'range' &&
            (active as HTMLInputElement).type !== 'checkbox' &&
            (active as HTMLInputElement).type !== 'radio') ||
           active.tagName === 'TEXTAREA' ||
           active.isContentEditable);
        if (isEditing) return;
        
        e.preventDefault();
        e.stopPropagation();
        if (currentFileIndexRef.current <= 0) {
          setTransformAllDialogVisible(true);
        }
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
      
      // 'O' key recalls the origin view (saved when Transform Images dialog closes)
      // If origin view exists, restore it; otherwise use default origin view
      const originView = homeViews[0]; // Slot 0 is the origin view
      if (originView) {
        // Restore saved origin view
        setViewScale(originView.zoom);
        setViewRotation(originView.viewRotation ?? 0);
        setViewFlipX(originView.viewFlipX ?? false);
        setIsBottomView(originView.isBottomView ?? false);
        setTransparency(originView.transparency ?? 50);
        
        // Restore PCB position by moving all objects so the reference point is back at saved position
        const savedRefX = originView.pcbReferenceX ?? originView.x ?? 0;
        const savedRefY = originView.pcbReferenceY ?? originView.y ?? 0;
        
        // Calculate current reference point
        let currentRefX = 0;
        let currentRefY = 0;
        if (topImage) {
          currentRefX = topImage.x;
          currentRefY = topImage.y;
        } else if (bottomImage) {
          currentRefX = bottomImage.x;
          currentRefY = bottomImage.y;
        }
        
        // Calculate delta needed to move PCB back to saved position
        const deltaX = savedRefX - currentRefX;
        const deltaY = savedRefY - currentRefY;
        
        // Move all objects by the delta (same as Hand tool does)
        if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
          // Move images
          if (topImage) {
            setTopImage({ ...topImage, x: topImage.x + deltaX, y: topImage.y + deltaY });
          }
          if (bottomImage) {
            setBottomImage({ ...bottomImage, x: bottomImage.x + deltaX, y: bottomImage.y + deltaY });
          }
          
          // Move components
          setComponentsTop(componentsTop.map(comp => ({
            ...comp,
            x: comp.x + deltaX,
            y: comp.y + deltaY
          })));
          setComponentsBottom(componentsBottom.map(comp => ({
            ...comp,
            x: comp.x + deltaX,
            y: comp.y + deltaY
          })));
          
          // Move power symbols
          setPowerSymbols(powerSymbols.map(p => ({
            ...p,
            x: p.x + deltaX,
            y: p.y + deltaY
          })));
          
          // Move ground symbols
          setGroundSymbols(groundSymbols.map(g => ({
            ...g,
            x: g.x + deltaX,
            y: g.y + deltaY
          })));
          
          // Move drawing strokes
          setDrawingStrokes(drawingStrokes.map(stroke => ({
            ...stroke,
            points: stroke.points.map(point => ({
              ...point,
              x: point.x + deltaX,
              y: point.y + deltaY
            }))
          })));
          
          // Move vias
          setVias(vias.map(via => ({
            ...via,
            x: via.x + deltaX,
            y: via.y + deltaY
          })));
          
          // Move pads
          setPads(pads.map(pad => ({
            ...pad,
            x: pad.x + deltaX,
            y: pad.y + deltaY
          })));
        }
        
        // Restore layer visibility
        setShowTopImage(originView.showTopImage);
        setShowBottomImage(originView.showBottomImage);
        setShowViasLayer(originView.showViasLayer);
        setShowTopTracesLayer(originView.showTopTracesLayer);
        setShowBottomTracesLayer(originView.showBottomTracesLayer);
        setShowTopPadsLayer(originView.showTopPadsLayer);
        setShowBottomPadsLayer(originView.showBottomPadsLayer);
        setShowTopTestPointsLayer(originView.showTopTestPointsLayer);
        setShowBottomTestPointsLayer(originView.showBottomTestPointsLayer);
        setShowTopComponents(originView.showTopComponents);
        setShowBottomComponents(originView.showBottomComponents);
        setShowPowerLayer(originView.showPowerLayer);
        setShowGroundLayer(originView.showGroundLayer);
        setShowConnectionsLayer(originView.showConnectionsLayer);
      } else {
        // No saved origin view - use default origin view
        setViewScale(1);
        setViewRotation(0);
        setViewFlipX(false);
        setIsBottomView(false);
        setTransparency(0); // Top view = 0 transparency
      }
      
      // Ensure camera is at (0,0)
      setCameraWorldCenter({ x: 0, y: 0 });
      
      // Reset browser zoom to 100%
      if (document.body) {
        document.body.style.zoom = '1';
      }
      if (document.documentElement) {
        document.documentElement.style.zoom = '1';
      }
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
      setShowTestPointLayerChooser(false);
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
      
      // Save snapshot before deleting
      saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
      
      // Handle each type independently so one locked type doesn't prevent deleting others
      if (selectedIds.size > 0) {
        // Filter out locked vias and traces
        const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
        const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
        const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
        const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
        const hasLockedTestPoints = areTestPointsLocked && selectedStrokes.some(s => s.type === 'testPoint');
        if (hasLockedVias) {
          alert('Cannot delete: Vias are locked. Unlock vias to delete them.');
        } else if (hasLockedTraces) {
          alert('Cannot delete: Traces are locked. Unlock traces to delete them.');
        } else if (hasLockedPads) {
          alert('Cannot delete: Pads are locked. Unlock pads to delete them.');
        } else if (hasLockedTestPoints) {
          alert('Cannot delete: Test points are locked. Unlock test points to delete them.');
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
    // Unified Undo: CMD-Z (Mac) or CTRL-Z (Windows/Linux)
    // Works for all tools and restores the last state snapshot
    if ((e.key === 'z' || e.key === 'Z') && 
        (e.ctrlKey || e.metaKey) && 
        !e.shiftKey && !e.altKey) {
      // Ignore if user is typing in an input field, textarea, or contenteditable
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
        return; // Let browser handle undo in text fields
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      // Perform undo and restore state
      const snapshot = performUndo();
      if (snapshot) {
        // Find objects that were added (exist in current state but not in snapshot)
        // and unregister their NodeIDs
        
        // Find added drawing strokes and unregister their point IDs
        const snapshotStrokeIds = new Set(snapshot.drawingStrokes.map((s: DrawingStroke) => s.id));
        for (const stroke of drawingStrokes) {
          if (!snapshotStrokeIds.has(stroke.id)) {
            // This stroke was added, unregister its point IDs
            for (const point of stroke.points) {
              if (point.id && typeof point.id === 'number') {
                unregisterAllocatedId(point.id);
              }
            }
          }
        }
        
        // Find added components and unregister their pin connection NodeIDs
        const snapshotComponentIds = new Set([...snapshot.componentsTop.map((c: PCBComponent) => c.id), ...snapshot.componentsBottom.map((c: PCBComponent) => c.id)]);
        for (const comp of [...componentsTop, ...componentsBottom]) {
          if (!snapshotComponentIds.has(comp.id)) {
            // This component was added, unregister its pin connection NodeIDs
            for (const pinConnection of comp.pinConnections) {
              if (pinConnection && pinConnection.trim() !== '') {
                const nodeId = parseInt(pinConnection, 10);
                if (!isNaN(nodeId) && nodeId > 0) {
                  unregisterAllocatedId(nodeId);
                }
              }
            }
          }
        }
        
        // Find added power symbols and unregister their point IDs
        const snapshotPowerIds = new Set(snapshot.powerSymbols.map((p: PowerSymbol) => p.id));
        for (const power of powerSymbols) {
          if (!snapshotPowerIds.has(power.id) && power.pointId && typeof power.pointId === 'number') {
            unregisterAllocatedId(power.pointId);
          }
        }
        
        // Find added ground symbols and unregister their point IDs
        const snapshotGroundIds = new Set(snapshot.groundSymbols.map((g: GroundSymbol) => g.id));
        for (const ground of groundSymbols) {
          if (!snapshotGroundIds.has(ground.id) && ground.pointId && typeof ground.pointId === 'number') {
            unregisterAllocatedId(ground.pointId);
          }
        }
        
        // Restore state from snapshot
        setDrawingStrokes(snapshot.drawingStrokes);
        setComponentsTop(snapshot.componentsTop);
        setComponentsBottom(snapshot.componentsBottom);
        setPowerSymbols(snapshot.powerSymbols);
        setGroundSymbols(snapshot.groundSymbols);
        // Clear any in-progress drawing
        setCurrentStroke([]);
      }
      return;
    }

    // Copy component: CMD-C (Mac) or CTRL-C (Windows/Linux)
    if ((e.key === 'c' || e.key === 'C') && 
        (e.ctrlKey || e.metaKey) && 
        !e.shiftKey && !e.altKey) {
      // Ignore if user is typing in an input field, textarea, or contenteditable
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
        return; // Let browser handle copy in text fields
      }
      
      // Only copy if exactly one component is selected
      if (selectedComponentIds.size === 1) {
        e.preventDefault();
        e.stopPropagation();
        
        const componentId = Array.from(selectedComponentIds)[0];
        const component = [...componentsTop, ...componentsBottom].find(c => c.id === componentId);
        
        if (component) {
          setCopiedComponent(component);
          console.log('Component copied:', component.id, component.designator, 'orientation:', component.orientation, 'flipX:', component.flipX, 'flipY:', component.flipY);
        }
      }
      return;
    }

    // Paste component: CMD-V (Mac) or CTRL-V (Windows/Linux)
    if ((e.key === 'v' || e.key === 'V') && 
        (e.ctrlKey || e.metaKey) && 
        !e.shiftKey && !e.altKey) {
      // Ignore if user is typing in an input field, textarea, or contenteditable
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
        return; // Let browser handle paste in text fields
      }
      
      if (copiedComponent && !areComponentsLocked) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get all existing components to assign next designator
        const allComponents = [...componentsTop, ...componentsBottom];
        
        // Prepare counters based on mode (same logic as component creation)
        let counters: Record<string, number>;
        if (useGlobalDesignatorCounters) {
          // Global mode: reload from localStorage each time to get latest values
          counters = loadDesignatorCounters();
        } else {
          // Project-local mode: use session counters (starts empty, gets updated as components are created)
          counters = { ...sessionDesignatorCountersRef.current };
        }
        
        // Extract prefix from the original designator (e.g., "U8" -> "U")
        // Maintain the same prefix signature but increment the number
        let prefix: string;
        if (copiedComponent.designator) {
          // Match letters followed by numbers (e.g., "U8", "R1", "C5", "Q12")
          const designatorMatch = copiedComponent.designator.match(/^([A-Za-z]+)(\d+)$/);
          if (designatorMatch) {
            prefix = designatorMatch[1]; // Extract the prefix (letters part)
          } else {
            // Fallback to default prefix if designator doesn't match expected pattern
            prefix = getDefaultPrefix(copiedComponent.componentType);
          }
        } else {
          // Fallback to default prefix if no designator exists
          prefix = getDefaultPrefix(copiedComponent.componentType);
        }
        
        const nextNumber = getNextDesignatorNumber(prefix, allComponents, counters);
        const newDesignator = `${prefix}${nextNumber}`;
        
        // Update designator counter (same logic as component creation)
        if (useGlobalDesignatorCounters) {
          // Update global counters in localStorage
          const currentCounters = loadDesignatorCounters();
          const updatedCounters = updateDesignatorCounter(prefix, nextNumber, currentCounters);
          saveDesignatorCounters(updatedCounters);
        } else {
          // Update session counters for project-local mode
          sessionDesignatorCountersRef.current[prefix] = Math.max(
            sessionDesignatorCountersRef.current[prefix] || 0,
            nextNumber
          );
        }
        
        // Clone the component with new ID, new designator, and no connections
        const clonedComponent: PCBComponent = {
          ...copiedComponent,
          id: generateUniqueId('comp'),
          designator: newDesignator,
          pinConnections: new Array(copiedComponent.pinCount).fill(''), // Clear all connections
          pinPolarities: copiedComponent.pinPolarities ? new Array(copiedComponent.pinCount).fill('') : undefined, // Clear polarities
          // Position offset by 5mm to the right and down
          x: copiedComponent.x + 5,
          y: copiedComponent.y + 5,
          // Explicitly preserve orientation properties
          orientation: copiedComponent.orientation,
          flipX: copiedComponent.flipX,
          flipY: copiedComponent.flipY,
        };
        
        // Preserve pinNames if they exist
        if ((copiedComponent as any).pinNames) {
          (clonedComponent as any).pinNames = [...(copiedComponent as any).pinNames];
        }
        
        console.log('Component pasted with orientation:', clonedComponent.orientation, 'flipX:', clonedComponent.flipX, 'flipY:', clonedComponent.flipY);
        
        // Add to the appropriate layer
        if (clonedComponent.layer === 'top') {
          setComponentsTop(prev => [...prev, clonedComponent]);
        } else {
          setComponentsBottom(prev => [...prev, clonedComponent]);
        }
        
        // Select the newly pasted component
        clearAllSelections();
        setSelectedComponentIds(new Set([clonedComponent.id]));
        
        console.log('Component pasted:', clonedComponent.id, clonedComponent.designator);
      }
      return;
    }

    // Option+V and Option+P: Open IC Placement dialogs
    // Use e.code instead of e.key to handle macOS Option key special characters
    // On macOS, Option+V produces '√' and Option+P produces 'π', so e.key won't match
    // e.code represents the physical key pressed, so 'KeyV' and 'KeyP' work on all OS
    if (e.code === 'KeyV' && 
        e.altKey && 
        !e.ctrlKey && !e.shiftKey && !isReadOnly) {
      // Ignore if user is typing in an input field, textarea, or contenteditable
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
        return; // Let browser handle input in text fields
      }
      
      e.preventDefault();
      e.stopPropagation();
      setICPlacementIsPad(false);
      setShowICPlacementDialog(true);
      return;
    }
    
    if (e.code === 'KeyP' && 
        e.altKey && 
        !e.ctrlKey && !e.shiftKey && !isReadOnly) {
      // Ignore if user is typing in an input field, textarea, or contenteditable
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
        return; // Let browser handle input in text fields
      }
      
      e.preventDefault();
      e.stopPropagation();
      setICPlacementIsPad(true);
      setShowICPlacementDialog(true);
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
            clearAllSelections(); // Clear all selections when tool is selected
            switchToSelectTool();
            return;
          case 'a':
          case 'A':
            e.preventDefault();
            selectAll(); // Select all visible objects on the canvas
            return;
          case 'u':
          case 'U':
            // Open Component Properties dialog for selected component(s)
            // If multiple components are selected, open the most recently selected one
            if (!isReadOnly && selectedComponentIds.size > 0) {
              e.preventDefault();
        
        // Get the most recently selected component (last item in Set)
        // Sets preserve insertion order, so the last item is the most recent
        const componentIdArray = Array.from(selectedComponentIds);
        const mostRecentComponentId = componentIdArray[componentIdArray.length - 1];
        
        // Find the component in top or bottom layer
        let foundComponent: PCBComponent | null = null;
        let foundLayer: 'top' | 'bottom' | null = null;
        
        foundComponent = componentsTop.find(c => c.id === mostRecentComponentId) || null;
        if (foundComponent) {
          foundLayer = 'top';
        } else {
          foundComponent = componentsBottom.find(c => c.id === mostRecentComponentId) || null;
          if (foundComponent) {
            foundLayer = 'bottom';
          }
        }
        
        // Open the component editor if found
        if (foundComponent && foundLayer) {
          openComponentEditor(foundComponent, foundLayer);
        }
      }
            return;
          case 'b':
          case 'B':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            if (powerBuses.length === 1) {
              // Single bus: auto-select and switch to power tool
              setSelectedPowerBusId(powerBuses[0].id);
              setCurrentTool('power');
              setShowPowerBusSelector(false);
              setShowPowerLayer(true); // Automatically enable power layer visibility
            } else if (powerBuses.length > 1) {
              // Multiple buses: show selector but don't switch tool until selection
              setShowPowerBusSelector(true);
              // Keep current tool (don't switch to power yet)
            } else {
              // No buses: show selector
              setShowPowerBusSelector(true);
              setCurrentTool('power');
              setShowPowerLayer(true); // Automatically enable power layer visibility
            }
            return;
          case 'g':
          case 'G':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            if (groundBuses.length === 1) {
              // Single bus: auto-select and switch to ground tool
              setSelectedGroundBusId(groundBuses[0].id);
              setCurrentTool('ground');
              setShowGroundBusSelector(false);
              setShowGroundLayer(true); // Automatically enable ground layer visibility
            } else if (groundBuses.length > 1) {
              // Multiple buses: show selector but don't switch tool until selection
              setShowGroundBusSelector(true);
              // Keep current tool (don't switch to ground yet)
            } else {
              // No buses: show selector
              setShowGroundBusSelector(true);
              setCurrentTool('ground');
              setShowGroundLayer(true); // Automatically enable ground layer visibility
            }
            return;
          case 'v':
          case 'V':
            // Regular V: Select via tool
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setDrawingMode('via');
            setCurrentTool('draw');
            setShowViasLayer(true); // Automatically enable vias layer visibility
            // The useEffect hook will load via tool settings automatically
            return;
          case 'p':
          case 'P':
            // Regular P: Select pad tool
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setDrawingMode('pad');
            setCurrentTool('draw');
            // The useEffect hook will automatically apply the default layer and show the layer chooser
            return;
          case 'y':
          case 'Y':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setDrawingMode('testPoint');
            setCurrentTool('draw');
            // The useEffect hook will automatically apply the default layer and show the layer chooser
            return;
          case 't':
          case 'T':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setDrawingMode('trace');
            setCurrentTool('draw');
            // The useEffect hook will automatically apply the default layer and show the layer chooser
            return;
          case 'c':
          case 'C':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setCurrentTool('component');
            // The useEffect hook will show the component selection dialog
            // Restore last selected component type if available
            if (lastSelectedComponentTypeRef.current) {
              setSelectedComponentType(lastSelectedComponentTypeRef.current);
            } else {
              setSelectedComponentType(null);
            }
            return;
          case 'e':
          case 'E':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setCurrentTool('erase');
            return;
          case 'h':
          case 'H':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setCurrentTool('pan');
            return;
          case 'x':
          case 'X':
            e.preventDefault();
            clearAllSelections(); // Clear all selections when tool is selected
            setCurrentTool('center');
            // Start waiting for number key with 2-second timeout
            setIsWaitingForHomeViewKey(true);
            // Clear any existing timeout
            if (homeViewTimeoutRef.current) {
              clearTimeout(homeViewTimeoutRef.current);
            }
            // Set 2-second timeout to return to select tool if no number is pressed
            homeViewTimeoutRef.current = setTimeout(() => {
              setIsWaitingForHomeViewKey(false);
              setCurrentTool('select');
              setCanvasCursor(undefined);
            }, 2000);
            return;
          case 'm':
          case 'M':
            // Select Magnify tool (default to zoom-in)
            if (!e.ctrlKey) {
              e.preventDefault();
              clearAllSelections(); // Clear all selections when tool is selected
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

        // Explicitly check which image(s) to scale based on selectedImageForTransform
        // Only scale the specifically selected image, not both
        if (selectedImageForTransform === 'top') {
          // Only scale top image - do not scale bottom
          if (topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
            } : null);
          }
          return;
        }
        
        if (selectedImageForTransform === 'bottom') {
          // Only scale bottom image - do not scale top
          if (bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
            } : null);
          }
          return;
        }
        
        if (selectedImageForTransform === 'both') {
          // Apply to both images only when 'both' is explicitly selected
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
          return;
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

        // Explicitly check which image(s) to rotate based on selectedImageForTransform
        // Only rotate the specifically selected image, not both
        if (selectedImageForTransform === 'top') {
          // Only rotate top image - do not rotate bottom
          if (topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              rotation: prev.rotation + rotationDelta
            } : null);
          }
          // Explicitly return to prevent any other rotation logic from executing
          return;
        }
        
        if (selectedImageForTransform === 'bottom') {
          // Only rotate bottom image - do not rotate top
          if (bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              rotation: prev.rotation + rotationDelta
            } : null);
          }
          // Explicitly return to prevent any other rotation logic from executing
          return;
        }
        
        if (selectedImageForTransform === 'both') {
          // Apply to both images only when 'both' is explicitly selected
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
          return;
        }
        // If selectedImageForTransform is null or doesn't match, do nothing
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
            skewXDeltaDeg = 0.5;
            break;
          case 'ArrowRight':
            skewXDeltaDeg = -0.5;
            break;
          default:
            break;
        }

        if (skewXDeltaDeg !== 0 || skewYDeltaDeg !== 0) {
          const toRad = degToRad;
          const clamp = (v: number) => Math.max(-0.7, Math.min(0.7, v)); // clamp to ~±40° to avoid extremes
          
          // Explicitly check which image(s) to skew based on selectedImageForTransform
          // Only skew the specifically selected image, not both
          if (selectedImageForTransform === 'top') {
            // Only skew top image - do not skew bottom
            if (topImage) {
              setTopImage(prev => prev ? {
                ...prev,
                skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
                skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
              } : null);
            }
            return;
          }
          
          if (selectedImageForTransform === 'bottom') {
            // Only skew bottom image - do not skew top
            if (bottomImage) {
              setBottomImage(prev => prev ? {
                ...prev,
                skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
                skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
              } : null);
            }
            return;
          }
          
          if (selectedImageForTransform === 'both') {
            // Apply to both images only when 'both' is explicitly selected
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
            return;
          }
        }
      } else if (transformMode === 'keystone') {
        // Perspective-like keystone: Up/Down = vertical keystone, Left/Right = horizontal keystone; ±0.5°
        let kHDeltaDeg = 0; // horizontal keystone
        let kVDeltaDeg = 0; // vertical keystone

        switch (e.key) {
          case 'ArrowUp':
            kVDeltaDeg = 0.5;
            break;
          case 'ArrowDown':
            kVDeltaDeg = -0.5;
            break;
          case 'ArrowLeft':
            kHDeltaDeg = 0.5;
            break;
          case 'ArrowRight':
            kHDeltaDeg = -0.5;
            break;
          default:
            break;
        }

        if (kHDeltaDeg !== 0 || kVDeltaDeg !== 0) {
          const toRad = degToRad;
          const clamp = (v: number) => Math.max(-0.35, Math.min(0.35, v)); // clamp to ~±20° to avoid extremes
          
          // Explicitly check which image(s) to apply keystone based on selectedImageForTransform
          // Only apply keystone to the specifically selected image, not both
          if (selectedImageForTransform === 'top') {
            // Only apply keystone to top image - do not apply to bottom
            if (topImage) {
              setTopImage(prev => prev ? {
                ...prev,
                keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
                keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
              } : null);
            }
            return;
          }
          
          if (selectedImageForTransform === 'bottom') {
            // Only apply keystone to bottom image - do not apply to top
            if (bottomImage) {
              setBottomImage(prev => prev ? {
                ...prev,
                keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
                keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
              } : null);
            }
            return;
          }
          
          if (selectedImageForTransform === 'both') {
            // Apply to both images only when 'both' is explicitly selected
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
            return;
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
  }, [currentTool, selectedImageForTransform, transformMode, topImage, bottomImage, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds, powerBuses, drawingMode, finalizeTraceIfAny, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, switchToSelectTool, selectAll, setComponentsTop, setComponentsBottom, performUndo, setDrawingStrokes, setPowerSymbols, setGroundSymbols, powerSymbols, groundSymbols, switchPerspective, rotatePerspective, homeViews, viewScale, viewRotation, viewFlipX, isBottomView, transparency, setViewScale, setViewRotation, setViewFlipX, setIsBottomView, setTransparency, setTopImage, setBottomImage, setVias, setPads, setCameraWorldCenter, setCurrentView, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds, setCurrentTool, vias, pads, showTopImage, showBottomImage, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopPadsLayer, showBottomPadsLayer, showTopTestPointsLayer, showBottomTestPointsLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer, showConnectionsLayer, setShowTopImage, setShowBottomImage, setShowViasLayer, setShowTopTracesLayer, setShowBottomTracesLayer, setShowTopPadsLayer, setShowBottomPadsLayer, setShowTopTestPointsLayer, setShowBottomTestPointsLayer, setShowTopComponents, setShowBottomComponents, setShowPowerLayer, setShowGroundLayer, setShowConnectionsLayer, setICPlacementIsPad, setShowICPlacementDialog, openComponentEditor, currentStroke, setCurrentStroke]);

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
  }, [handleKeyDown, selectedPowerIds, selectedGroundIds, arePowerNodesLocked, arePowerNodesLocked, powers, grounds, increaseSize, decreaseSize, switchToSelectTool, selectedComponentIds, componentsTop, componentsBottom, setComponentsTop, setComponentsBottom, homeViews, isWaitingForHomeViewKey, currentTool]);

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
      { id: 'powerbus-default', name: '+5VDC', voltage: '+5', color: '#ff0000' },
    ]);
    // Reset ground buses to defaults
    setGroundBuses([
      { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
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
    // Reset point ID counter and clear allocated IDs tracking
    resetPointIdCounter();
    // Clear undo snapshot
    clearSnapshot();
  }, [saveDefaultColor, saveDefaultSize, clearSnapshot]);

  // NOTE: closeProject will be replaced with module version after refs are defined (see below around line 10304)
  // Temporary legacy implementation - keeping for now until module version is fully integrated
  const closeProject = useCallback(() => {
    // === STEP 1: Release browser file system permissions ===
    setProjectDirHandle(null);
    setAutoSaveDirHandle(null);
    
    // Clear refs that hold directory handles
    // NOTE: Refs are defined later in the file, so we can't access them here
    // The module version (created after refs) will handle this properly
    
    // === STEP 2: Clear file operation state ===
    setCurrentProjectFilePath('');
    setProjectName('');
    setAutoSaveEnabled(false);
    setAutoSaveInterval(null);
    setAutoSaveBaseName('');
    setAutoSaveFileHistory([]);
    setCurrentFileIndex(-1);
    
    // Clear auto-save refs
    // NOTE: Refs are defined later in the file, so we can't access them here
    // The module version (created after refs) will handle this properly
    // hasChangesSinceLastAutoSaveRef.current = false; // Commented out - ref not available yet
    setHasUnsavedChangesState(false);
    setIsBottomView(false);
    setOriginalTopFlipX(null);
    setOriginalBottomFlipX(null);
    
    // Clear auto-save interval timer
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    
    // === STEP 3: Clear all project data ===
    // Clean up image resources before clearing state
    if (topImage) {
      cleanupImageResources(topImage);
    }
    if (bottomImage) {
      cleanupImageResources(bottomImage);
    }
    setTopImage(null);
    setBottomImage(null);
    clearSnapshot();
    setDrawingStrokes([]);
    setVias([]);
    setPads([]);
    setTracesTop([]);
    setTracesBottom([]);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
    setComponentsTop([]);
    setComponentsBottom([]);
    setComponentEditor(null);
    setConnectingPin(null);
    setPowerSymbols([]);
    setGroundSymbols([]);
    setPowerEditor(null);
    setPowerBuses([{ id: 'powerbus-default', name: '+5VDC', voltage: '+5', color: '#ff0000' }]);
    setGroundBuses([{ id: 'groundbus-circuit', name: 'GND', color: '#000000' }]);
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setIsSelecting(false);
    setProjectNotes([]);
    setProjectMetadata({ productName: '', modelNumber: '', manufacturer: '', dateManufactured: new Date().toISOString().split('T')[0] });
    setNodeProperties(new Map());
    setCurrentView('overlay');
    setViewScale(1);
    setCameraCenter(0, 0);
    setShowBothLayers(true);
    setSelectedDrawingLayer('top');
    setHomeViews({});
    setIsWaitingForHomeViewKey(false);
    if (homeViewTimeoutRef.current) {
      clearTimeout(homeViewTimeoutRef.current);
      homeViewTimeoutRef.current = null;
    }
    setSelectedImageForTransform(null);
    setIsTransforming(false);
    setTransformStartPos(null);
    setTransformMode('nudge');
    setIsGrayscale(false);
    setTransparency(50);
    setIsTransparencyCycling(false);
    setTransparencyCycleSpeed(2000);
    setAreImagesLocked(false);
    setAreViasLocked(false);
    setArePadsLocked(false);
    setAreTestPointsLocked(false);
    setAreTracesLocked(false);
    setAreComponentsLocked(false);
    setAreGroundNodesLocked(false);
    setArePowerNodesLocked(false);
    setShowTopImage(true);
    setShowBottomImage(true);
    setShowViasLayer(true);
    setShowTopTracesLayer(true);
    setShowBottomTracesLayer(true);
    setShowTopPadsLayer(true);
    setShowBottomPadsLayer(true);
    setShowTopTestPointsLayer(true);
    setShowBottomTestPointsLayer(true);
    setShowTopComponents(true);
    setShowBottomComponents(true);
    setShowPowerLayer(true);
    setShowGroundLayer(true);
    setShowConnectionsLayer(true);
    setShowTraceCornerDots(false);
    setShowTraceEndDots(true);
    setCurrentTool('select');
    setDrawingMode('trace');
    setTraceToolLayer('top');
    setPadToolLayer('top');
    setTestPointToolLayer('top');
    setComponentToolLayer('top');
    traceToolLayerRef.current = 'top';
    padToolLayerRef.current = 'top';
    testPointToolLayerRef.current = 'top';
    componentToolLayerRef.current = 'top';
    sessionDesignatorCountersRef.current = {};
    setAutoAssignDesignators(true);
    setUseGlobalDesignatorCounters(false);
    resetPointIdCounter();
    toolInstanceManager.initialize();
    setOpenMenu(null);
    setDebugDialog({ visible: false, text: '' });
    setErrorDialog({ visible: false, title: '', message: '' });
    setNewProjectDialog({ visible: false });
    setOpenProjectDialog({ visible: false });
    setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
    setSaveAsDialog({ visible: false, filename: '', locationPath: '', locationHandle: null });
    setAutoSaveDialog({ visible: false, interval: null });
    setAutoSavePromptDialog({ visible: false, source: 'new', interval: 5 });
    setShowColorPicker(false);
    setShowPowerBusManager(false);
    setShowGroundBusManager(false);
    setShowDesignatorManager(false);
    setShowBoardDimensionsDialog(false);
    setNotesDialogVisible(false);
    setProjectNotesDialogVisible(false);
    setTransformImagesDialogVisible(false);
    setTransformAllDialogVisible(false);
    setBoardDimensions(null);
    setHoverComponent(null);
    setHoverTestPoint(null);
    setIsPanning(false);
    panStartRef.current = null;
    panClientStartRef.current = null;
    setIsDrawing(false);
    setTracePreviewMousePos(null);
    lastTraceClickTimeRef.current = 0;
    isDoubleClickingTraceRef.current = false;
    console.log('Project closed: All state cleared and browser permissions released');
  }, []); // Empty dependency array - this is the legacy implementation, replaced by module version

  // Legacy closeProject implementation (replaced by module version above)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _closeProjectLegacy = useCallback(() => {
    // === STEP 1: Release browser file system permissions ===
    // Clear directory handles to release browser permissions
    // Note: Browser permissions are automatically released when handles are garbage collected,
    // but explicitly clearing them ensures immediate release
    setProjectDirHandle(null);
    setAutoSaveDirHandle(null);
    
    // Clear refs that hold directory handles
    if (projectDirHandleRef) {
      projectDirHandleRef.current = null;
    }
    if (autoSaveDirHandleRef) {
      autoSaveDirHandleRef.current = null;
    }
    
    // === STEP 2: Clear file operation state ===
    setCurrentProjectFilePath('');
    setProjectName('');
    setAutoSaveEnabled(false);
    setAutoSaveInterval(null);
    setAutoSaveBaseName('');
    setAutoSaveFileHistory([]);
    setCurrentFileIndex(-1);
    // Note: No localStorage to clear - all project data is stored in project file only
    
    // Clear auto-save refs
    if (autoSaveBaseNameRef) {
      autoSaveBaseNameRef.current = '';
    }
    hasChangesSinceLastAutoSaveRef.current = false;
    // Clear save status indicator (project is saved)
    setHasUnsavedChangesState(false);
    // Reset transform all view state
    setIsBottomView(false);
    setOriginalTopFlipX(null);
    setOriginalBottomFlipX(null);
    
    // Clear auto-save interval timer
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    
    // === STEP 3: Clear all project data ===
    // Clean up image resources before clearing state
    if (topImage) {
      cleanupImageResources(topImage);
    }
    if (bottomImage) {
      cleanupImageResources(bottomImage);
    }
    // Clear images
    setTopImage(null);
    setBottomImage(null);
    
    // Clear undo snapshot
    clearSnapshot();
    
    // Clear drawing data
    setDrawingStrokes([]);
    setVias([]);
    setPads([]);
    setTracesTop([]);
    setTracesBottom([]);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
    
    // Clear components
    setComponentsTop([]);
    setComponentsBottom([]);
    setComponentEditor(null);
    setConnectingPin(null);
    
    // Clear power and ground symbols
    setPowerSymbols([]);
    setGroundSymbols([]);
    setPowerEditor(null);
    
    // Reset power buses to defaults
    setPowerBuses([
      { id: 'powerbus-default', name: '+5VDC', voltage: '+5', color: '#ff0000' },
    ]);
    
    // Reset ground buses to defaults
    setGroundBuses([
      { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
    ]);
    
    // === STEP 4: Clear selections ===
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setIsSelecting(false);
    
    // === STEP 5: Clear project notes and metadata ===
    setProjectNotes([]);
    setProjectMetadata({
      productName: '',
      modelNumber: '',
      manufacturer: '',
      dateManufactured: new Date().toISOString().split('T')[0], // Auto-fill with current date
    });
    setTroubleshootingResults(null);
    setNodeProperties(new Map());
    
    // === STEP 6: Reset view state ===
    setCurrentView('overlay');
    setViewScale(1);
    setCameraCenter(0, 0);
    setShowBothLayers(true);
    setSelectedDrawingLayer('top');
    setHomeViews({}); // Clear all home views
    setIsWaitingForHomeViewKey(false);
    if (homeViewTimeoutRef.current) {
      clearTimeout(homeViewTimeoutRef.current);
      homeViewTimeoutRef.current = null;
    }
    
    // === STEP 7: Reset transform state ===
    setSelectedImageForTransform(null);
    setIsTransforming(false);
    setTransformStartPos(null);
    setTransformMode('nudge');
    
    // === STEP 8: Reset image filters ===
    setIsGrayscale(false);
    setTransparency(50);
    setIsTransparencyCycling(false);
    setTransparencyCycleSpeed(2000); // Reset to default 2 seconds
    
    // === STEP 9: Reset lock states ===
    setAreImagesLocked(false);
    setAreViasLocked(false);
    setArePadsLocked(false);
    setAreTestPointsLocked(false);
    setAreTracesLocked(false);
    setAreComponentsLocked(false);
    setAreGroundNodesLocked(false);
    setArePowerNodesLocked(false);
    
    // === STEP 10: Reset visibility states ===
    setShowTopImage(true);
    setShowBottomImage(true);
    setShowViasLayer(true);
    setShowTopTracesLayer(true);
    setShowBottomTracesLayer(true);
    setShowTopPadsLayer(true);
    setShowBottomPadsLayer(true);
    setShowTopTestPointsLayer(true);
    setShowBottomTestPointsLayer(true);
    setShowTopComponents(true);
    setShowBottomComponents(true);
    setShowPowerLayer(true);
    setShowGroundLayer(true);
    setShowConnectionsLayer(true);
    setShowTraceCornerDots(false);
    setShowTraceEndDots(true);
    
    // === STEP 11: Reset tool state ===
    setCurrentTool('select');
    setDrawingMode('trace');
    // Reset tool layer defaults to 'top' for new projects
    setTraceToolLayer('top');
    setPadToolLayer('top');
    setTestPointToolLayer('top');
    setComponentToolLayer('top');
    
    // Reset tool layer refs to 'top' for new projects
    traceToolLayerRef.current = 'top';
    padToolLayerRef.current = 'top';
    testPointToolLayerRef.current = 'top';
    componentToolLayerRef.current = 'top';
    
    // === STEP 12: Reset designator counters ===
    sessionDesignatorCountersRef.current = {};
    setAutoAssignDesignators(true);
    setUseGlobalDesignatorCounters(false);
    // Note: No localStorage to clear - all project data is stored in project file only
    
    // === STEP 13: Reset point ID counter and clear allocated IDs tracking ===
    resetPointIdCounter();
    
    // === STEP 13.5: Reset module-level singleton state ===
    // CRITICAL: Reset toolInstanceManager to prevent state leakage between projects
    // This module-level singleton persists across component remounts, so must be explicitly reset
    toolInstanceManager.initialize();
    
    // === STEP 14: Close all dialogs ===
    setOpenMenu(null);
    setDebugDialog({ visible: false, text: '' });
    setErrorDialog({ visible: false, title: '', message: '' });
    setNewProjectDialog({ visible: false });
    setOpenProjectDialog({ visible: false });
    setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
    setSaveAsDialog({ visible: false, filename: '', locationPath: '', locationHandle: null });
    setAutoSaveDialog({ visible: false, interval: null });
    setAutoSavePromptDialog({ visible: false, source: 'new', interval: 5 });
    setShowColorPicker(false);
    setShowPowerBusManager(false);
    setShowGroundBusManager(false);
    setShowDesignatorManager(false);
    setShowBoardDimensionsDialog(false);
    setNotesDialogVisible(false);
    setProjectNotesDialogVisible(false);
    setTransformImagesDialogVisible(false);
    
    // === STEP 15: Reset board dimensions ===
    setBoardDimensions(null);
    // Note: No localStorage to clear - board dimensions are stored in project file only
    
    // === STEP 16: Clear hover states ===
    setHoverComponent(null);
    setHoverTestPoint(null);
    
    // === STEP 17: Reset panning state ===
    setIsPanning(false);
    panStartRef.current = null;
    panClientStartRef.current = null;
    
    // === STEP 18: Reset drawing state ===
    setIsDrawing(false);
    setTracePreviewMousePos(null);
    lastTraceClickTimeRef.current = 0;
    isDoubleClickingTraceRef.current = false;
    
    console.log('Project closed: All state cleared and browser permissions released');
  }, [
    // File operation setters
    setProjectDirHandle, setAutoSaveDirHandle, setCurrentProjectFilePath, setProjectName,
    setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveBaseName, setAutoSaveFileHistory, setCurrentFileIndex,
    // Image setters
    setTopImage, setBottomImage,
    // Drawing setters
    setDrawingStrokes, setCurrentStroke, setVias, setPads, setTracesTop, setTracesBottom,
    // Component setters
    setComponentsTop, setComponentsBottom, setComponentEditor, setConnectingPin,
    // Power/Ground setters
    setPowerSymbols, setGroundSymbols, setPowerEditor, setPowerBuses, setGroundBuses,
    // Selection setters
    setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds, setIsSelecting,
    // Project notes setter
    setProjectNotes,
    // View setters
    setCurrentView, setViewScale, setViewPan, setShowBothLayers, setSelectedDrawingLayer, setHomeViews, setIsWaitingForHomeViewKey,
    // Transform setters
    setSelectedImageForTransform, setIsTransforming, setTransformStartPos, setTransformMode,
    // Image filter setters
    setIsGrayscale, setTransparency, setIsTransparencyCycling, setTransparencyCycleSpeed,
    // Lock setters
    setAreImagesLocked, setAreViasLocked, setArePadsLocked, setAreTestPointsLocked, setAreTracesLocked,
    setAreComponentsLocked, setAreGroundNodesLocked, setArePowerNodesLocked,
    // Visibility setters
    setShowTopImage, setShowBottomImage, setShowViasLayer, setShowTopTracesLayer, setShowBottomTracesLayer,
    setShowTopPadsLayer, setShowBottomPadsLayer, setShowTopTestPointsLayer, setShowBottomTestPointsLayer,
    setShowTopComponents, setShowBottomComponents, setShowPowerLayer, setShowGroundLayer, setShowConnectionsLayer,
    // Tool setters
    setCurrentTool, setDrawingMode, setTraceToolLayer, setPadToolLayer, setTestPointToolLayer, setComponentToolLayer,
    // Designator setters
    setAutoAssignDesignators, setUseGlobalDesignatorCounters,
    // Dialog setters
    setOpenMenu, setDebugDialog, setErrorDialog, setNewProjectDialog, setNewProjectSetupDialog, setSaveAsDialog,
    setAutoSaveDialog, setAutoSavePromptDialog,
    // Undo hook
    clearSnapshot, setShowColorPicker, setShowPowerBusManager, setShowGroundBusManager,
    setShowDesignatorManager, setShowBoardDimensionsDialog, setNotesDialogVisible, setProjectNotesDialogVisible,
    // Other setters
    setBoardDimensions, setHoverComponent, setHoverTestPoint, setIsPanning, setIsDrawing, setTracePreviewMousePos,
  ]);
  // Suppress unused variable warning for legacy function (kept for reference)
  void _closeProjectLegacy;

  // NOTE: ensureProjectIsolationCallback will be created after refs are defined (see below)

  // Initialize application with default keyboard shortcuts (o and s)
  // This function performs the same initialization as when the app first loads
  const initializeApplication = useCallback(() => {
    // First, set all defaults
    initializeApplicationDefaults();
    // Use setTimeout to ensure DOM is ready, canvas is sized, and refs are available
    setTimeout(() => {
      // Reset view to center origin (0,0) on canvas
      // This must happen after canvas sizing to ensure correct centering
      setViewScale(1);
      setCameraWorldCenter({ x: 0, y: 0 }); // Center of canvas at 0,0 in world coordinates
      // Reset browser zoom to 100%
      if (document.body) {
        document.body.style.zoom = '1';
      }
      if (document.documentElement) {
        document.documentElement.style.zoom = '1';
      }
      // Clear all selections
      setSelectedIds(new Set());
      setSelectedComponentIds(new Set());
      setSelectedPowerIds(new Set());
      setSelectedGroundIds(new Set());
    }, 200); // Increased delay to ensure canvas sizing is complete
  }, [initializeApplicationDefaults, setViewScale, setCameraWorldCenter]);

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
  }, [finalizeTraceIfAny, showTraceLayerChooser, showPadLayerChooser, showColorPicker]);

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

  // Helper function to update test point chooser position
  const updateTestPointChooserPosition = useCallback(() => {
    if (testPointChooserRef.current && testPointButtonRef.current) {
      requestAnimationFrame(() => {
        if (testPointChooserRef.current && testPointButtonRef.current) {
          const pos = getDialogPosition(testPointButtonRef as React.RefObject<HTMLButtonElement | null>);
          testPointChooserRef.current.style.top = `${pos.top}px`;
          testPointChooserRef.current.style.left = `${pos.left}px`;
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
    if (showTestPointLayerChooser) {
      updateTestPointChooserPosition();
    }
  }, [showTestPointLayerChooser, updateTestPointChooserPosition]);


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
      // Convert to world coordinates accounting for view rotation and flip
      const worldPos = contentCanvasToWorld(contentCanvasX, contentCanvasY, viewPan, viewScale, viewRotation, viewFlipX);
      const x = worldPos.x;
      const y = worldPos.y;
      
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
  }, [connectingPin, componentsTop, componentsBottom, drawingStrokes, viewScale, viewPan.x, viewPan.y, viewRotation, viewFlipX]);

  // Helper function to constrain dialog position within window boundaries
  const constrainDialogPosition = useCallback((x: number, y: number, dialogWidth: number, dialogHeight: number): { x: number; y: number } => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 10; // Padding from edges
    
    // Constrain x position (prevent overflow on right edge, ensure not negative)
    let constrainedX = Math.max(padding, Math.min(x, windowWidth - dialogWidth - padding));
    
    // Constrain y position (prevent overflow on bottom edge, ensure not negative)
    let constrainedY = Math.max(padding, Math.min(y, windowHeight - dialogHeight - padding));
    
    return { x: constrainedX, y: constrainedY };
  }, []);

  // Handle component dialog dragging
  React.useEffect(() => {
    if (!isDraggingDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dialogDragOffset) return;
      const rawPosition = {
        x: e.clientX - dialogDragOffset.x,
        y: e.clientY - dialogDragOffset.y,
      };
      // Constrain position to window boundaries
      const newPosition = constrainDialogPosition(rawPosition.x, rawPosition.y, 250, window.innerHeight * 0.4);
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
  }, [isDraggingDialog, dialogDragOffset, constrainDialogPosition]);

  // Handle detailed info dialog dragging
  React.useEffect(() => {
    if (!isDraggingDetailedInfoDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!detailedInfoDialogDragOffset) return;
      const rawPosition = {
        x: e.clientX - detailedInfoDialogDragOffset.x,
        y: e.clientY - detailedInfoDialogDragOffset.y,
      };
      // Constrain position to window boundaries (same constraints as Component Properties dialog)
      const newPosition = constrainDialogPosition(rawPosition.x, rawPosition.y, 250, window.innerHeight * 0.4);
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
  }, [isDraggingDetailedInfoDialog, detailedInfoDialogDragOffset, constrainDialogPosition]);

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

  // Handle project notes dialog dragging
  React.useEffect(() => {
    if (!isDraggingProjectNotesDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!projectNotesDialogDragOffset) return;
      const newPosition = {
        x: e.clientX - projectNotesDialogDragOffset.x,
        y: e.clientY - projectNotesDialogDragOffset.y,
      };
      setProjectNotesDialogPosition(newPosition);
      // Save position to localStorage
      localStorage.setItem('projectNotesDialogPosition', JSON.stringify(newPosition));
    };

    const handleMouseUp = () => {
      setIsDraggingProjectNotesDialog(false);
      setProjectNotesDialogDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProjectNotesDialog, projectNotesDialogDragOffset]);

  // Handle test points dialog dragging
  React.useEffect(() => {
    if (!isDraggingTestPointsDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!testPointsDialogDragOffset) return;
      const newPosition = {
        x: e.clientX - testPointsDialogDragOffset.x,
        y: e.clientY - testPointsDialogDragOffset.y,
      };
      setTestPointsDialogPosition(newPosition);
      localStorage.setItem('testPointsDialogPosition', JSON.stringify(newPosition));
    };

    const handleMouseUp = () => {
      setIsDraggingTestPointsDialog(false);
      setTestPointsDialogDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTestPointsDialog, testPointsDialogDragOffset]);

  // Handle troubleshooting dialog dragging
  React.useEffect(() => {
    if (!isDraggingTroubleshootingDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!troubleshootingDialogDragOffset) return;
      const newPosition = {
        x: e.clientX - troubleshootingDialogDragOffset.x,
        y: e.clientY - troubleshootingDialogDragOffset.y,
      };
      setTroubleshootingDialogPosition(newPosition);
      localStorage.setItem('troubleshootingDialogPosition', JSON.stringify(newPosition));
    };

    const handleMouseUp = () => {
      setIsDraggingTroubleshootingDialog(false);
      setTroubleshootingDialogDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTroubleshootingDialog, troubleshootingDialogDragOffset]);
  
  // Handle net name suggestion dialog dragging
  React.useEffect(() => {
    if (!isDraggingNetNameSuggestionDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: e.clientX - netNameSuggestionDialogDragOffset.x,
        y: e.clientY - netNameSuggestionDialogDragOffset.y,
      };
      setNetNameSuggestionDialogPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDraggingNetNameSuggestionDialog(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingNetNameSuggestionDialog, netNameSuggestionDialogDragOffset]);

  // Initialize troubleshooting dialog position when it opens (load from localStorage or default)
  React.useEffect(() => {
    if (troubleshootingDialogVisible && troubleshootingDialogPosition === null) {
      const saved = localStorage.getItem('troubleshootingDialogPosition');
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          setTroubleshootingDialogPosition(savedPosition);
        } catch {
          setTroubleshootingDialogPosition({
            x: 100,
            y: 100,
          });
        }
      } else {
        setTroubleshootingDialogPosition({
          x: 100,
          y: 100,
        });
      }
    }
  }, [troubleshootingDialogVisible, troubleshootingDialogPosition]);

  // Initialize test points dialog position when it opens (load from localStorage or default)
  React.useEffect(() => {
    if (testPointsDialogVisible && testPointsDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('testPointsDialogPosition');
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          setTestPointsDialogPosition(savedPosition);
        } catch {
          // If parsing fails, use default position
          setTestPointsDialogPosition({
            x: 100,
            y: 100,
          });
        }
      } else {
        // No saved position, use default position
        setTestPointsDialogPosition({
          x: 100,
          y: 100,
        });
      }
    }
  }, [testPointsDialogVisible, testPointsDialogPosition]);

  // Initialize project notes dialog position when it opens (load from localStorage or default)
  React.useEffect(() => {
    if (projectNotesDialogVisible && projectNotesDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('projectNotesDialogPosition');
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          setProjectNotesDialogPosition(savedPosition);
        } catch {
          // If parsing fails, use default position
          setProjectNotesDialogPosition({
            x: 100,
            y: 100,
          });
        }
      } else {
        // No saved position, use default position
        setProjectNotesDialogPosition({
          x: 100,
          y: 100,
        });
      }
    }
  }, [projectNotesDialogVisible, projectNotesDialogPosition]);

  // Function to open project notes dialog
  const handleOpenProjectNotes = useCallback(() => {
    setProjectNotesDialogVisible(true);
  }, []);

  const handleOpenTestPoints = useCallback(() => {
    setTestPointsDialogVisible(true);
  }, []);

  // Function to open information dialog
  const handleOpenInformation = useCallback(() => {
    // Trigger the same logic as pressing 'I' key
    const debugInfo: string[] = [];
    
    // Check selected drawing strokes (vias, traces)
    if (selectedIds.size > 0) {
      // Drawing strokes are now displayed in formatted UI sections
    }
    
    if (selectedIds.size === 0 && selectedComponentIds.size === 0 && selectedPowerIds.size === 0 && selectedGroundIds.size === 0) {
      debugInfo.push('\nNo objects selected.');
    }
    
    const debugText = debugInfo.join('\n');
    setDebugDialog({ visible: true, text: debugText });
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, setDebugDialog]);

  // Initialize dialog position when it opens (load from localStorage or center of screen)
  React.useEffect(() => {
    if (componentEditor && componentEditor.visible && componentDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('componentDialogPosition');
      let position: { x: number; y: number };
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          // Constrain saved position to window boundaries
          position = constrainDialogPosition(savedPosition.x, savedPosition.y, 250, window.innerHeight * 0.4);
          setComponentDialogPosition(position);
        } catch {
          // If parsing fails, use default upper right position (to the right of canvas, below menu bar)
          position = constrainDialogPosition(window.innerWidth - 280, 90, 250, window.innerHeight * 0.4);
          setComponentDialogPosition(position);
        }
      } else {
        // No saved position, use default upper right position (to the right of canvas, below menu bar)
        position = constrainDialogPosition(window.innerWidth - 280, 90, 250, window.innerHeight * 0.4);
        setComponentDialogPosition(position);
      }
    } else if (!componentEditor || !componentEditor.visible) {
      // Don't reset position when dialog closes - keep it for next time
      // setComponentDialogPosition(null);
    }
  }, [componentEditor, componentDialogPosition, constrainDialogPosition]);

  // Initialize detailed info dialog position when it opens (load from localStorage or default)
  React.useEffect(() => {
    if (debugDialog.visible && detailedInfoDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('detailedInfoDialogPosition');
      let position: { x: number; y: number };
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          // Constrain saved position to window boundaries
          position = constrainDialogPosition(savedPosition.x, savedPosition.y, 400, window.innerHeight * 0.8);
          setDetailedInfoDialogPosition(position);
        } catch {
          // If parsing fails, use default upper right position (to the right of canvas, below menu bar)
          position = constrainDialogPosition(window.innerWidth - 450, 90, 400, window.innerHeight * 0.8);
          setDetailedInfoDialogPosition(position);
        }
      } else {
        // No saved position, use default upper right position (to the right of canvas, below menu bar)
        position = constrainDialogPosition(window.innerWidth - 450, 90, 400, window.innerHeight * 0.8);
        setDetailedInfoDialogPosition(position);
      }
    } else if (!debugDialog.visible) {
      // Don't reset position when dialog closes - keep it for next time
      // setDetailedInfoDialogPosition(null);
    }
  }, [debugDialog.visible, detailedInfoDialogPosition, constrainDialogPosition]);

  // Constrain dialog positions when window is resized
  React.useEffect(() => {
    const handleResize = () => {
      // Constrain component dialog position
      if (componentDialogPosition) {
        const constrained = constrainDialogPosition(componentDialogPosition.x, componentDialogPosition.y, 250, window.innerHeight * 0.4);
        if (constrained.x !== componentDialogPosition.x || constrained.y !== componentDialogPosition.y) {
          setComponentDialogPosition(constrained);
          localStorage.setItem('componentDialogPosition', JSON.stringify(constrained));
        }
      }
      // Constrain detailed info dialog position
      if (detailedInfoDialogPosition) {
        const constrained = constrainDialogPosition(detailedInfoDialogPosition.x, detailedInfoDialogPosition.y, 400, window.innerHeight * 0.8);
        if (constrained.x !== detailedInfoDialogPosition.x || constrained.y !== detailedInfoDialogPosition.y) {
          setDetailedInfoDialogPosition(constrained);
          localStorage.setItem('detailedInfoDialogPosition', JSON.stringify(constrained));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [componentDialogPosition, detailedInfoDialogPosition, constrainDialogPosition]);

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

  // Transparency auto-cycle (0% → 100% → 0%) with configurable period while checked
  // We need a ref to track the current speed so the animation loop can access it
  const transparencyCycleSpeedRef = React.useRef(transparencyCycleSpeed);
  React.useEffect(() => {
    transparencyCycleSpeedRef.current = transparencyCycleSpeed;
  }, [transparencyCycleSpeed]);

  React.useEffect(() => {
    if (isTransparencyCycling) {
      transparencyCycleStartRef.current = performance.now();
      setTransparency(0);
      const tick = (now: number) => {
        const start = transparencyCycleStartRef.current || now;
        const periodMs = transparencyCycleSpeedRef.current; // Use ref for current speed
        const phase = ((now - start) % periodMs) / periodMs; // 0..1
        const tri = 1 - Math.abs(1 - 2 * phase); // 0→1→0 over period
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

  // Memory monitoring (updates every 1 minute if enabled)
  // This helps detect memory leaks during development and testing
  React.useEffect(() => {
    if (!ENABLE_MEMORY_MONITOR) return;
    
    const updateMemoryInfo = () => {
      // Check if performance.memory is available (Chrome/Edge only)
      // TypeScript doesn't know about performance.memory, so we use type assertion
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        setMemoryInfo({
          usedJSHeapSize: perfMemory.usedJSHeapSize,
          totalJSHeapSize: perfMemory.totalJSHeapSize,
          jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
          timestamp: Date.now(),
        });
      } else {
        // Fallback for browsers that don't support performance.memory (Firefox, Safari)
        setMemoryInfo({
          usedJSHeapSize: 0,
          totalJSHeapSize: 0,
          jsHeapSizeLimit: 0,
          timestamp: Date.now(),
        });
      }
    };
    
    // Update immediately on mount
    updateMemoryInfo();
    
    // Update every 1 minute (60000 ms)
    const interval = setInterval(updateMemoryInfo, 60000);
    
    return () => clearInterval(interval);
  }, [ENABLE_MEMORY_MONITOR]);

  // Dynamic custom cursor that reflects tool, mode, color and brush size
  React.useEffect(() => {
    if (currentTool === 'center') {
      setCanvasCursor(generateCenterCursor());
      return;
    }
    
    // When in IC/Pattern Placement mode, show via or pad cursor
    const isPatternPlacementActive = isICPlacementMode && (icPlacementIsPad || !icPlacementIsPad);
    
    const kind: 'trace' | 'via' | 'pad' | 'testPoint' | 'erase' | 'magnify' | 'ground' | 'component' | 'power' | 'default' =
      isPatternPlacementActive
        ? (icPlacementIsPad ? 'pad' : 'via')
        : currentTool === 'erase'
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
        ? (drawingMode === 'via' ? 'via' : drawingMode === 'pad' ? 'pad' : drawingMode === 'testPoint' ? 'testPoint' : 'trace')
        : 'default';
    if (kind === 'default') { setCanvasCursor(undefined); return; }

    // Scale cursor size to match what will be drawn on canvas.
    // Tool sizes are in world coordinates (pixels), so multiply by viewScale to get screen pixels.
    const scale = viewScale;

    let diameterPx: number;
    if (kind === 'magnify') {
      diameterPx = 18;
    } else if (kind === 'component') {
      // Use component tool instance size (single source of truth), not generic brushSize.
      const layer = componentToolLayer || 'top';
      const componentInstanceId = layer === 'top' ? 'componentTop' : 'componentBottom';
      const componentInstance = toolInstanceManager.get(componentInstanceId);
      const worldSize = componentInstance.size || COMPONENT_ICON.DEFAULT_SIZE;
      diameterPx = Math.max(16, Math.round(worldSize * scale));
    } else if (kind === 'trace') {
      // Use trace tool instance size (single source of truth), not generic brushSize.
      const layer = traceToolLayer || 'top';
      const traceInstanceId = layer === 'top' ? 'traceTop' : 'traceBottom';
      const traceInstance = toolInstanceManager.get(traceInstanceId);
      const worldSize = traceInstance.size || 6;
      diameterPx = Math.max(6, Math.round(worldSize * scale));
    } else if (kind === 'via') {
      // Use via tool instance size (single source of truth)
      const viaInstance = toolInstanceManager.get('via');
      const worldSize = viaInstance.size || 6;
      diameterPx = Math.max(6, Math.round(worldSize * scale));
    } else if (kind === 'pad') {
      // Use pad tool instance size (single source of truth)
      const layer = padToolLayer || 'top';
      const padInstanceId = layer === 'top' ? 'padTop' : 'padBottom';
      const padInstance = toolInstanceManager.get(padInstanceId);
      const worldSize = padInstance.size || 6;
      diameterPx = Math.max(6, Math.round(worldSize * scale));
    } else if (kind === 'testPoint') {
      // Use test point tool instance size (single source of truth)
      const layer = testPointToolLayer || 'top';
      const testPointInstanceId = layer === 'top' ? 'testPointTop' : 'testPointBottom';
      const testPointInstance = toolInstanceManager.get(testPointInstanceId);
      const worldSize = testPointInstance.size || 18;
      diameterPx = Math.max(12, Math.round(worldSize * scale));
    } else if (kind === 'power' || kind === 'ground') {
      diameterPx = Math.max(12, Math.round(brushSize * scale));
    } else {
      diameterPx = Math.max(6, Math.round(brushSize * scale));
    }

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
      
      // Use tool instance directly (single source of truth)
      const viaInstance = toolInstanceManager.get('via');
      const viaColor = viaInstance.color;
      
      // Draw annulus using even-odd fill rule
      ctx.fillStyle = viaColor;
      ctx.beginPath();
      // Outer circle
      ctx.arc(cx, cy, rOuter, 0, TWO_PI);
      // Inner circle (creates the hole with even-odd fill rule)
      ctx.arc(cx, cy, rInner, 0, TWO_PI);
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
      // Use tool instance directly (single source of truth)
      const padInstanceId = padToolLayer === 'top' ? 'padTop' : 'padBottom';
      const padInstance = toolInstanceManager.get(padInstanceId);
      const padColor = padInstance.color;
      // Use diameterPx based on pad tool instance size (already scaled above)
      const padDiameterPx = diameterPx;
      const padR = padDiameterPx / 2;
      
      // Draw pad as square annulus (square with square hole) - similar to via but square
      const outerSize = padR * 2;
      const innerSize = outerSize * 0.5; // Inner square is half the size
      const crosshairLength = padR * 0.7;
      
      // Draw square annulus using even-odd fill rule
      ctx.fillStyle = padColor;
      ctx.beginPath();
      // Outer square
      ctx.rect(cx - padR, cy - padR, outerSize, outerSize);
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
      // Use tool instance directly (single source of truth)
      const traceInstanceId = traceToolLayer === 'top' ? 'traceTop' : 'traceBottom';
      const traceInstance = toolInstanceManager.get(traceInstanceId);
      const traceColor = traceInstance.color;
      ctx.fillStyle = traceColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
      ctx.fill();
    } else if (kind === 'testPoint') {
      // Use test point tool instance size (already scaled into diameterPx)
      setCanvasCursor(generateTestPointCursor(diameterPx));
      return;
    } else if (kind === 'erase') {
      // Draw tilted pink eraser matching toolbar icon shape
      // Scale brushSize to match what will be drawn on canvas
      const scaledBrushSize = brushSize * scale;
      const width = Math.max(scaledBrushSize * 0.75, 8); // Width of eraser
      const height = Math.max(scaledBrushSize * 0.5, 6); // Height of eraser
      const tipHeight = Math.max(scaledBrushSize * 0.2, 2); // Tip height
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(degToRad(-35)); // Rotate -35 degrees to match toolbar icon
      
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
      ctx.arc(cx - 2, cy - 2, lensR, 0, TWO_PI);
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
      // Use selected ground bus color (matches the bus that will be drawn)
      const selectedBus = selectedGroundBusId ? groundBuses.find(b => b.id === selectedGroundBusId) : null;
      const groundColor = selectedBus?.color || '#000000'; // Default to black if no bus selected
      ctx.strokeStyle = groundColor;
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
      ctx.arc(cx, cy, r, 0, TWO_PI);
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
      // Draw power symbol cursor: empty circle with extending vertical and horizontal lines
      // Use selected power bus color (matches the bus that will be drawn)
      const selectedBus = selectedPowerBusId ? powerBuses.find(b => b.id === selectedPowerBusId) : null;
      const powerColor = selectedBus?.color || '#ff0000'; // Default to red if no bus selected
      ctx.strokeStyle = powerColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const lineExtension = r * 0.8; // Lines extend outside the circle
      
      // Draw empty circle (not filled)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
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
      // Use tool instance directly (single source of truth)
      const layer = componentToolLayer || 'top';
      const componentInstanceId = layer === 'top' ? 'componentTop' : 'componentBottom';
      const componentInstance = toolInstanceManager.get(componentInstanceId);
      const componentColor = componentInstance.color;
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
      // Draw abbreviation text - use specific designator from metadata if available
      const abbrev = (() => {
        const primaryDesignator =
          selectedComponentMetadata?.dataDrivenDefinition?.designator ??
          selectedComponentMetadata?.componentDefinition?.designator ??
          selectedComponentMetadata?.designator;

        if (primaryDesignator) {
          return primaryDesignator.length <= 3
            ? primaryDesignator
            : primaryDesignator.substring(0, 3);
        }
        return selectedComponentType ? getDefaultAbbreviation(selectedComponentType) : '?';
      })();
      ctx.fillStyle = componentColor;
      ctx.font = `bold ${Math.max(8, compSize * 0.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(abbrev, cx, cy);
    }
    const url = `url(${canvas.toDataURL()}) ${Math.round(cx)} ${Math.round(cy)}, crosshair`;
    setCanvasCursor(url);
  }, [currentTool, drawingMode, brushColor, brushSize, viewScale, isShiftPressed, isOptionPressed, isICPlacementMode, icPlacementIsPad, selectedComponentType, selectedComponentMetadata, selectedPowerBusId, selectedGroundBusId, powerBuses, groundBuses, toolRegistry, traceToolLayer, padToolLayer, testPointToolLayer, componentToolLayer, toolState.toolInstanceId]);

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
      } else if (stroke.type === 'testPoint' && stroke.points.length > 0 && stroke.points[0].id !== undefined) {
        const nodeId = stroke.points[0].id;
        const newTestPointTypeString = determineTestPointType(nodeId, powerBuses);
        const newTestPointType: 'power' | 'ground' | 'signal' | 'unknown' = 
          newTestPointTypeString.includes('Power') ? 'power' :
          newTestPointTypeString.includes('Ground') ? 'ground' :
          newTestPointTypeString.includes('Signal') ? 'signal' :
          'unknown';
        // Only update if type changed to avoid unnecessary re-renders
        if (stroke.testPointType !== newTestPointType) {
          return { ...stroke, testPointType: newTestPointType };
        }
      }
      return stroke;
    }));
  }, [powers, grounds, powerBuses, determineViaType, determinePadType, determineTestPointType]);

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
      } else if (s.type === 'testPoint' && s.points.length > 0 && s.points[0].id !== undefined) {
        const nodeId = s.points[0].id;
        const newTestPointTypeString = determineTestPointType(nodeId, powerBuses);
        const newTestPointType: 'power' | 'ground' | 'signal' | 'unknown' = 
          newTestPointTypeString.includes('Power') ? 'power' :
          newTestPointTypeString.includes('Ground') ? 'ground' :
          newTestPointTypeString.includes('Signal') ? 'signal' :
          'unknown';
        if (s.testPointType !== newTestPointType) {
          return { ...s, testPointType: newTestPointType };
        }
      }
      return s;
    }));
  }, [powers, grounds, powerBuses, determineViaType, determinePadType, determineTestPointType]);

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
        cameraWorldCenter, // Save camera center in world coordinates
        showBothLayers,
        selectedDrawingLayer,
      },
      images: {
        top: topImage ? {
          name: topImage.name,
          width: topImage.width,
          height: topImage.height,
          filePath: topImage.filePath || topImage.name, // Path relative to project directory (e.g., "images/filename.jpg")
          // Images are stored as files in images/ subdirectory, not embedded in JSON
          x: topImage.x, y: topImage.y, // World coordinates - saved as-is
          scale: topImage.scale,
          rotation: topImage.rotation,
          flipX: topImage.flipX, flipY: topImage.flipY,
          skewX: topImage.skewX, skewY: topImage.skewY,
          keystoneV: topImage.keystoneV, keystoneH: topImage.keystoneH,
          brightness: topImage.brightness ?? 100, // Default to 100 if not set
          contrast: topImage.contrast ?? 100, // Default to 100 if not set
        } : null,
        bottom: bottomImage ? {
          name: bottomImage.name,
          width: bottomImage.width,
          height: bottomImage.height,
          filePath: bottomImage.filePath || bottomImage.name, // Path relative to project directory (e.g., "images/filename.jpg")
          // Images are stored as files in images/ subdirectory, not embedded in JSON
          x: bottomImage.x, y: bottomImage.y,
          scale: bottomImage.scale,
          rotation: bottomImage.rotation,
          flipX: bottomImage.flipX, flipY: bottomImage.flipY,
          skewX: bottomImage.skewX, skewY: bottomImage.skewY,
          keystoneV: bottomImage.keystoneV, keystoneH: bottomImage.keystoneH,
          brightness: bottomImage.brightness ?? 100, // Default to 100 if not set
          contrast: bottomImage.contrast ?? 100, // Default to 100 if not set
        } : null,
      },
      // Store project directory name for future saves and auto-saves
      // Note: FileSystemDirectoryHandle doesn't expose full file system paths for security reasons
      // We store the directory name and use the directory handle to access files
      // CRITICAL: Use projectDirHandleRef.current for auto-save to ensure we use the correct directory
      // The ref is updated immediately when opening a project, while state updates are async
      projectDirectoryName: projectDirHandleRef.current ? projectDirHandleRef.current.name || null : (projectDirHandle ? projectDirHandle.name || null : null),
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
      designatorCounters: { ...sessionDesignatorCountersRef.current }, // Save designator counters for each prefix
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
      testPointColors: {
        top: toolRegistry.get('testPoint')?.layerSettings.get('top')?.color || topTestPointColor,
        bottom: toolRegistry.get('testPoint')?.layerSettings.get('bottom')?.color || bottomTestPointColor,
      },
      testPointSizes: {
        top: toolRegistry.get('testPoint')?.layerSettings.get('top')?.size || topTestPointSize,
        bottom: toolRegistry.get('testPoint')?.layerSettings.get('bottom')?.size || bottomTestPointSize,
      },
      componentConnectionColor: componentConnectionColor,
      componentConnectionSize: componentConnectionSize,
      toolLayerDefaults: {
        trace: traceToolLayer,
        pad: padToolLayer,
        testPoint: testPointToolLayer,
        component: componentToolLayer,
      },
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
        showTraceCornerDots,
        showTraceEndDots,
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
      projectNotes, // Save project notes (Name, Value pairs)
      projectMetadata, // Save project metadata (Product Name, Model Number, Manufacturer, Date Manufactured)
      troubleshootingResults, // Save troubleshooting analysis results
      nodeProperties: serializeNodeProperties(nodeProperties), // Save node optional fields for hybrid netlist
      homeViews, // Save all home view locations (0-9)
      toolInstances: toolInstanceManager.getAll(), // Save all tool instances (single source of truth)
    };
    return { project, timestamp: ts };
  }, [currentView, viewScale, cameraWorldCenter, showBothLayers, selectedDrawingLayer, topImage, bottomImage, drawingStrokes, vias, tracesTop, tracesBottom, componentsTop, componentsBottom, grounds, toolRegistry, areImagesLocked, areViasLocked, arePadsLocked, areTracesLocked, areComponentsLocked, areGroundNodesLocked, arePowerNodesLocked, powerBuses, groundBuses, getPointIdCounter, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize, traceToolLayer, padToolLayer, testPointToolLayer, componentToolLayer, autoSaveEnabled, autoSaveInterval, autoSaveBaseName, projectName, showViasLayer, showTopPadsLayer, showBottomPadsLayer, showTopTracesLayer, showBottomTracesLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer, showConnectionsLayer, autoAssignDesignators, useGlobalDesignatorCounters, projectNotes, projectMetadata, nodeProperties, homeViews]);

  // Ref to store the latest buildProjectData function to avoid recreating performAutoSave
  const buildProjectDataRef = useRef(buildProjectData);
  buildProjectDataRef.current = buildProjectData;

  // Ref to store the setter for current project file path so we can update it from auto save
  const setCurrentProjectFilePathRef = useRef(setCurrentProjectFilePath);
  setCurrentProjectFilePathRef.current = setCurrentProjectFilePath;

  // Create project isolation state object for use with isolation module
  // Must be created after all refs are defined
  const isolationState: ProjectIsolationState = {
    // File operation setters
    setProjectDirHandle,
    setAutoSaveDirHandle,
    setCurrentProjectFilePath,
    setProjectName,
    setAutoSaveEnabled,
    setAutoSaveInterval,
    setAutoSaveBaseName,
    setAutoSaveFileHistory,
    setCurrentFileIndex,
    setHasUnsavedChangesState,
    // Image setters
    setTopImage,
    setBottomImage,
    // Image cleanup function
    cleanupImageResources,
    // Drawing setters
    setDrawingStrokes,
    setCurrentStroke,
    setVias,
    setPads,
    setTracesTop,
    setTracesBottom,
    // Component setters
    setComponentsTop,
    setComponentsBottom,
    setComponentEditor,
    setConnectingPin,
    // Power/Ground setters
    setPowerSymbols,
    setGroundSymbols,
    setPowerEditor,
    setPowerBuses,
    setGroundBuses,
    // Selection setters
    setSelectedIds,
    setSelectedComponentIds,
    setSelectedPowerIds,
    setSelectedGroundIds,
    setIsSelecting,
    // Project notes setter
    setProjectNotes,
    setProjectMetadata,
    setTroubleshootingResults,
    // View setters
    setCurrentView,
    setViewScale,
    setCameraCenter,
    setCameraWorldCenter,
    setShowBothLayers,
    setSelectedDrawingLayer,
    setHomeViews,
    setIsWaitingForHomeViewKey,
    // Transform setters
    setSelectedImageForTransform,
    setIsTransforming,
    setTransformStartPos,
    setTransformMode,
    setIsBottomView,
    setOriginalTopFlipX,
    setOriginalBottomFlipX,
    // Image filter setters
    setIsGrayscale,
    setTransparency,
    setIsTransparencyCycling,
    setTransparencyCycleSpeed,
    // Lock setters
    setAreImagesLocked,
    setAreViasLocked,
    setArePadsLocked,
    setAreTestPointsLocked,
    setAreTracesLocked,
    setAreComponentsLocked,
    setAreGroundNodesLocked,
    setArePowerNodesLocked,
    // Visibility setters
    setShowTopImage,
    setShowBottomImage,
    setShowViasLayer,
    setShowTopTracesLayer,
    setShowBottomTracesLayer,
    setShowTopPadsLayer,
    setShowBottomPadsLayer,
    setShowTopTestPointsLayer,
    setShowBottomTestPointsLayer,
    setShowTopComponents,
    setShowBottomComponents,
    setShowPowerLayer,
    setShowGroundLayer,
    setShowConnectionsLayer,
    setShowTraceCornerDots,
    setShowTraceEndDots,
    // Tool setters
    setCurrentTool,
    setDrawingMode,
    setTraceToolLayer,
    setPadToolLayer,
    setTestPointToolLayer,
    setComponentToolLayer,
    // Designator setters
    setAutoAssignDesignators,
    setUseGlobalDesignatorCounters,
    // Dialog setters
    setOpenMenu,
    setDebugDialog,
    setErrorDialog,
    setNewProjectDialog,
    setOpenProjectDialog,
    setNewProjectSetupDialog,
    setSaveAsDialog,
    setAutoSaveDialog,
    setAutoSavePromptDialog,
    setShowColorPicker,
    setShowPowerBusManager,
    setShowGroundBusManager,
    setShowDesignatorManager,
    setShowBoardDimensionsDialog,
    setNotesDialogVisible,
    setProjectNotesDialogVisible,
    setTransformImagesDialogVisible,
    setTransformAllDialogVisible,
    // Other setters
    setBoardDimensions,
    setHoverComponent,
    setHoverTestPoint,
    setIsPanning,
    setIsDrawing,
    setTracePreviewMousePos,
    // Undo hook
    clearSnapshot,
    // Refs
    projectDirHandleRef,
    autoSaveDirHandleRef,
    autoSaveBaseNameRef,
    autoSaveIntervalRef,
    hasChangesSinceLastAutoSaveRef,
    currentProjectFilePathRef,
    autoSaveFileHistoryRef,
    currentFileIndexRef,
    currentStrokeRef,
    sessionDesignatorCountersRef,
    traceToolLayerRef,
    padToolLayerRef,
    testPointToolLayerRef,
    componentToolLayerRef,
    homeViewTimeoutRef,
    panStartRef,
    panClientStartRef,
    lastTraceClickTimeRef,
    isDoubleClickingTraceRef,
  };

  // Close the current project and release all browser permissions
  // This function clears ALL project state to ensure a clean slate before opening/creating a new project
  // CRITICAL: This prevents state leakage between projects (directory permissions, file paths, project notes, etc.)
  const closeProjectReal = useMemo(() => createCloseProject(isolationState), [
    // File operation setters
    setProjectDirHandle, setAutoSaveDirHandle, setCurrentProjectFilePath, setProjectName,
    setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveBaseName, setAutoSaveFileHistory, setCurrentFileIndex,
    // Image setters
    setTopImage, setBottomImage,
    // Drawing setters
    setDrawingStrokes, setCurrentStroke, setVias, setPads, setTracesTop, setTracesBottom,
    // Component setters
    setComponentsTop, setComponentsBottom, setComponentEditor, setConnectingPin,
    // Power/Ground setters
    setPowerSymbols, setGroundSymbols, setPowerEditor, setPowerBuses, setGroundBuses,
    // Selection setters
    setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds, setIsSelecting,
    // Project notes setter
    setProjectNotes, setProjectMetadata, setTroubleshootingResults,
    // View setters
    setCurrentView, setViewScale, setCameraCenter, setCameraWorldCenter, setShowBothLayers, setSelectedDrawingLayer, setHomeViews, setIsWaitingForHomeViewKey,
    // Transform setters
    setSelectedImageForTransform, setIsTransforming, setTransformStartPos, setTransformMode, setIsBottomView, setOriginalTopFlipX, setOriginalBottomFlipX,
    // Image filter setters
    setIsGrayscale, setTransparency, setIsTransparencyCycling, setTransparencyCycleSpeed,
    // Lock setters
    setAreImagesLocked, setAreViasLocked, setArePadsLocked, setAreTestPointsLocked, setAreTracesLocked,
    setAreComponentsLocked, setAreGroundNodesLocked, setArePowerNodesLocked,
    // Visibility setters
    setShowTopImage, setShowBottomImage, setShowViasLayer, setShowTopTracesLayer, setShowBottomTracesLayer,
    setShowTopPadsLayer, setShowBottomPadsLayer, setShowTopTestPointsLayer, setShowBottomTestPointsLayer,
    setShowTopComponents, setShowBottomComponents, setShowPowerLayer, setShowGroundLayer, setShowConnectionsLayer, setShowTraceCornerDots, setShowTraceEndDots,
    // Tool setters
    setCurrentTool, setDrawingMode, setTraceToolLayer, setPadToolLayer, setTestPointToolLayer, setComponentToolLayer,
    // Designator setters
    setAutoAssignDesignators, setUseGlobalDesignatorCounters,
    // Dialog setters
    setOpenMenu, setDebugDialog, setErrorDialog, setNewProjectDialog, setNewProjectSetupDialog, setSaveAsDialog,
    setAutoSaveDialog, setAutoSavePromptDialog,
    // Undo hook
    clearSnapshot, setShowColorPicker, setShowPowerBusManager, setShowGroundBusManager,
    setShowDesignatorManager, setShowBoardDimensionsDialog, setNotesDialogVisible, setProjectNotesDialogVisible, setTransformImagesDialogVisible, setTransformAllDialogVisible,
    // Other setters
    setBoardDimensions, setHoverComponent, setHoverTestPoint, setIsPanning, setIsDrawing, setTracePreviewMousePos,
    // Refs
    projectDirHandleRef, autoSaveDirHandleRef, autoSaveBaseNameRef, autoSaveIntervalRef, hasChangesSinceLastAutoSaveRef,
    currentProjectFilePathRef, autoSaveFileHistoryRef, currentFileIndexRef, currentStrokeRef, sessionDesignatorCountersRef,
    traceToolLayerRef, padToolLayerRef, testPointToolLayerRef, componentToolLayerRef, homeViewTimeoutRef,
    panStartRef, panClientStartRef, lastTraceClickTimeRef, isDoubleClickingTraceRef,
  ]);

  // Replace placeholder closeProject with real implementation
  // Store the real implementation in a ref so it can be used
  const closeProjectRef = useRef<() => void>(closeProjectReal);
  
  // Wrapper that uses the real implementation
  const closeProjectWrapper = useCallback(() => {
    if (closeProjectRef.current) {
      closeProjectRef.current();
    }
  }, []);

  // Encapsulated function to ensure complete project isolation before opening/creating a new project
  // This function ensures NO state information can leak from the previous project to the new one
  const ensureProjectIsolationCallback = useCallback(async (): Promise<void> => {
    await ensureProjectIsolation(closeProjectWrapper);
  }, [closeProjectWrapper]);

  // Auto Save function - saves to a file handle with timestamped filename
  // Use refs to avoid recreating this function on every state change
  // Uses autoSaveDirHandle (set when auto-save is enabled) or falls back to projectDirHandle
  // NOTE: Do NOT show success alerts - the green circle indicator (setHasUnsavedChangesState(false))
  // is the only user feedback for auto-save completion
  // Wrapper that calls the module version
  const performAutoSave = useCallback(async () => {
    const dirHandle = autoSaveDirHandleRef.current || projectDirHandleRef.current;
    const baseName = autoSaveBaseNameRef.current;
    if (!dirHandle || !baseName) {
      return;
    }
    await performAutoSaveModule(
      dirHandle,
      baseName,
      hasChangesSinceLastAutoSaveRef,
      drawingStrokesRef,
      setDrawingStrokes,
      buildProjectDataRef.current,
      setCurrentProjectFilePath,
      currentProjectFilePathRef,
      setAutoSaveFileHistory,
      autoSaveFileHistoryRef,
      setCurrentFileIndex,
      currentFileIndexRef,
      setHasUnsavedChangesState,
      setAutoSaveEnabled,
      autoSaveIntervalRef
    );
  }, [autoSaveDirHandleRef, projectDirHandleRef, autoSaveBaseNameRef, hasChangesSinceLastAutoSaveRef, drawingStrokesRef, setDrawingStrokes, buildProjectDataRef, setCurrentProjectFilePath, currentProjectFilePathRef, setAutoSaveFileHistory, autoSaveFileHistoryRef, setCurrentFileIndex, currentFileIndexRef, setHasUnsavedChangesState, setAutoSaveEnabled, autoSaveIntervalRef]);
  
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
        // Reset save status indicator (project is saved - green)
        setHasUnsavedChangesState(false);
        hasChangesSinceLastAutoSaveRef.current = false;
        console.log(`Project saved successfully: ${projectName}/${filename}`);
        alert(`Project saved successfully!\n\nFile: ${filename}\nLocation: ${projectName}`);
        return;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Failed to save to project directory:', e);
        alert(`Failed to save project to directory.\n\nError: ${errorMessage}\n\nPlease try saving again or use Save As...`);
        // Directory handle may have been revoked - clear it so user can select a new one
        setProjectDirHandle(null);
        // Fall through to prompt user for directory
      }
    }
    
    // If we have a project name but no directory handle, prompt for directory
    if (projectName && !projectDirHandle) {
      const w = window as any;
      if (isElectron() || typeof w.showDirectoryPicker === 'function') {
        try {
          let dirHandle: any;
          if (isElectron()) {
            dirHandle = await electronShowDirectoryPicker();
          } else {
            dirHandle = await w.showDirectoryPicker();
          }
          setProjectDirHandle(dirHandle);
          // Now save using the new directory handle
          const filename = `${projectName}.json`;
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setCurrentProjectFilePath(filename);
          // Reset save status indicator (project is saved - green)
          setHasUnsavedChangesState(false);
          hasChangesSinceLastAutoSaveRef.current = false;
          console.log(`Project saved successfully: ${filename} in selected directory`);
          alert(`Project saved successfully!\n\nFile: ${filename}`);
          return;
        } catch (e) {
          if ((e as any)?.name !== 'AbortError') {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error('Failed to get directory:', e);
            alert(`Failed to select directory.\n\nError: ${errorMessage}\n\nFalling back to file picker...`);
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
        
        // Extract project name from filename and store it in state (no localStorage)
        const filenameFromHandle = savedFilename;
        const projectNameFromFile = filenameFromHandle.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (projectNameFromFile) {
          setProjectName(projectNameFromFile);
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
        
        console.log(`Project saved successfully: ${savedFilename}`);
        alert(`Project saved successfully!\n\nFile: ${savedFilename}`);
        return;
      } catch (e) {
        // If user cancels, fall back to download is unnecessary; just return
        if ((e as any)?.name === 'AbortError') return;
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn('showSaveFilePicker failed, falling back to download', e);
        alert(`File picker unavailable.\n\nError: ${errorMessage}\n\nFalling back to browser download...`);
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
    console.log(`Project downloaded: ${filename}`);
    alert(`Project downloaded successfully!\n\nFile: ${filename}\n\nNote: For better project management, use File → New Project or File → Open Project.`);
  }, [
    buildProjectData,
    projectDirHandle,
    projectName,
    setCurrentProjectFilePath,
    setProjectDirHandle,
    setHasUnsavedChangesState,
    setProjectName,
    setAutoSaveBaseName,
    autoSaveDirHandle,
    removeTimestampFromFilename,
  ]);

  // Generate PDF from BOM data
  const generateBOMPDF = useCallback((bomData: BOMData): Blob => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;
    const lineHeight = 7;
    const tableStartY = 60;
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill of Materials', pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight * 2;
    
    // Project info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (bomData.projectName) {
      doc.text(`Project: ${bomData.projectName}`, margin, yPos);
      yPos += lineHeight;
    }
    doc.text(`Exported: ${new Date(bomData.exportedAt).toLocaleString()}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Total Components: ${bomData.totalComponents} | Unique Components: ${bomData.uniqueComponents}`, margin, yPos);
    yPos = tableStartY;
    
    // Table headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const colWidths = [15, 50, 30, 20, 25, 30, 20]; // Qty, Type, Value, Package, Mfr, Part#, Layer
    const headers = ['Qty', 'Component Type', 'Value', 'Package', 'Manufacturer', 'Part Number', 'Layer'];
    let xPos = margin;
    
    headers.forEach((header, idx) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[idx];
    });
    
    yPos += lineHeight;
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += lineHeight * 0.5;
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    bomData.items.forEach((item) => {
      // Helper to ensure there is space for at least `neededLines` more text rows.
      const ensurePageSpace = (neededLines: number) => {
        if (yPos > pageHeight - margin - lineHeight * neededLines) {
        doc.addPage();
        yPos = margin + lineHeight;
      }
      };
      
      // Main BOM row ---------------------------------------------------------
      ensurePageSpace(3);
      xPos = margin;
      const rowData = [
        item.quantity.toString(),
        item.componentType,
        item.value || '-',
        item.packageType || '-',
        item.manufacturer || '-',
        item.partNumber || '-',
        item.layer,
      ];
      
      rowData.forEach((text, idx) => {
        // Truncate long text to fit column
        const maxWidth = colWidths[idx] - 2;
        const truncated = doc.splitTextToSize(text, maxWidth);
        doc.text(truncated[0] || '-', xPos, yPos);
        xPos += colWidths[idx];
      });
      
      yPos += lineHeight * 1.2;
      
      // Optional detail lines: Notes and Spec Sheet URL ----------------------
      const notes = (item.notes || '').toString().trim();
      const datasheet = (item as any).datasheet
        ? (item as any).datasheet.toString().trim()
        : '';
      
      const detailLines: string[] = [];
      if (notes) {
        detailLines.push(`Notes: ${notes}`);
      }
      if (datasheet) {
        detailLines.push(`Spec Sheet URL: ${datasheet}`);
      }
      
      if (detailLines.length > 0) {
        // Indent detail lines so they appear under the main item text
        const detailX = margin + colWidths[0] + 2; // just after Qty column
        const availableWidth = pageWidth - margin - detailX;
        
        detailLines.forEach((line) => {
          const wrapped = doc.splitTextToSize(line, availableWidth);
          wrapped.forEach((textLine: string) => {
            ensurePageSpace(2);
            doc.text(textLine, detailX, yPos);
            yPos += lineHeight * 0.9;
          });
        });
      }
      
      // Divider line between items -------------------------------------------
      ensurePageSpace(1);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += lineHeight * 0.5;
    });
    
    // Convert to blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }, []);

  // Export BOM function
  const handleExportBOM = useCallback(async () => {
    console.log('handleExportBOM called, format:', bomExportFormat);
    if (!projectDirHandle) {
      alert('Please create or open a project before exporting BOM.');
      return;
    }

    try {
      console.log('Generating BOM data...');
      // Generate BOM data
      const bomData = generateBOM(componentsTop, componentsBottom, projectName);
      console.log('BOM data generated:', bomData);
      
      // Get or create BOM directory
      console.log('Creating/getting BOM directory...');
      let bomDirHandle: FileSystemDirectoryHandle;
      try {
        bomDirHandle = await projectDirHandle.getDirectoryHandle('BOM', { create: true });
        console.log('BOM directory obtained');
      } catch (e) {
        console.error('Failed to get/create BOM directory:', e);
        alert('Failed to create BOM directory. See console for details.');
        return;
      }
      
      // Generate filename with timestamp
      const timestamp = formatTimestamp();
      let blob: Blob;
      let filename: string;
      
      if (bomExportFormat === 'pdf') {
        // Generate PDF
        console.log('Generating PDF...');
        blob = generateBOMPDF(bomData);
        filename = `BOM_${timestamp}.pdf`;
      } else {
        // Generate JSON
        console.log('Generating JSON...');
        const json = JSON.stringify(bomData, null, 2);
        blob = new Blob([json], { type: 'application/json' });
        filename = `BOM_${timestamp}.json`;
      }
      
      console.log('Saving file:', filename);
      
      // Save file
      const fileHandle = await bomDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      console.log('BOM file saved successfully');
      alert(`BOM exported successfully to ${filename} in BOM directory!`);
    } catch (e) {
      console.error('Failed to export BOM:', e);
      alert(`Failed to export BOM: ${e instanceof Error ? e.message : String(e)}. See console for details.`);
    }
  }, [projectDirHandle, componentsTop, componentsBottom, projectName, bomExportFormat, generateBOMPDF]);

  // Export netlist function
  // Accept format as parameter to avoid stale state issues (React state updates are async)
  const handleExportNetlist = useCallback(async () => {
    if (!projectDirHandle) {
      alert('Please create or open a project before exporting netlist.');
      return;
    }

    try {
      // Collect all components from both layers
      const allComponents = [...componentsTop, ...componentsBottom];
      
      // Generate Hybrid Net-Centric netlist with explicit nodes
      const netlistContent = generateHybridNetlist(
          allComponents,
          drawingStrokes,
          powers,
          grounds,
          powerBuses,
          groundBuses,
          projectName,
          nodeProperties
        );
      
      // Try to get AI suggestions for net names (before saving)
      try {
        const { analyzeNetNames } = await import('./utils/netNameInference');
        console.log('[Export] Requesting AI net name suggestions...');
        const result = await analyzeNetNames(netlistContent, 0.5); // Lower threshold to show more suggestions
        
        if (result.suggestions.length > 0) {
          console.log(`[Export] AI suggested ${result.suggestions.length} net name improvements`);
          // Store the netlist and suggestions, show dialog
          setPendingNetlistContent(netlistContent);
          setNetNameSuggestions(result.suggestions);
          setNetNameSuggestionDialogVisible(true);
          setNetNameSuggestionDialogPosition({ x: 150, y: 150 });
          return; // Wait for user to review suggestions
        } else {
          console.log('[Export] No AI suggestions available, proceeding with export');
          // No suggestions, proceed with export
        }
      } catch (aiError) {
        console.warn('[Export] AI net name analysis failed or was skipped:', aiError);
        // Continue with export even if AI fails
      }
      
      // Save the netlist (either no AI suggestions or AI failed)
      await saveNetlistToFile(netlistContent);
      
    } catch (e) {
      console.error('Failed to export netlist:', e);
      alert(`Failed to export netlist: ${e instanceof Error ? e.message : String(e)}. See console for details.`);
    }
  }, [projectDirHandle, componentsTop, componentsBottom, drawingStrokes, powers, grounds, powerBuses, groundBuses, projectName, nodeProperties]);
  
  // Helper function to save netlist to file
  const saveNetlistToFile = useCallback(async (netlistContent: string) => {
    if (!projectDirHandle) return;
    
    const filename = `${projectName}_netlist.json`;
    
    // Create blob with JSON MIME type
    const blob = new Blob([netlistContent], { type: 'application/json' });
    
    // Try to save using File System Access API in netlists subdirectory
    try {
      // Create or get the netlists subdirectory
      const netlistsDirHandle = await projectDirHandle.getDirectoryHandle('netlists', { create: true });
      
      // Save file in netlists subdirectory
      const fileHandle = await netlistsDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      alert(`Netlist exported successfully to netlists/${filename}!`);
    } catch (fsError) {
      // Fallback to download if File System Access API fails
      console.warn('File System Access API failed, using download fallback:', fsError);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(`Netlist downloaded as ${filename}!`);
    }
  }, [projectDirHandle, projectName]);

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
        
        // Only set up interval if we have both directory handle (autoSaveDirHandle or projectDirHandle) and base name
        // performAutoSave uses autoSaveDirHandleRef.current || projectDirHandleRef.current
        const hasDirHandle = autoSaveDirHandle || projectDirHandle;
        if (hasDirHandle && autoSaveBaseName) {
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
          console.log(`  - Auto save directory handle: ${autoSaveDirHandle ? 'set' : 'missing'}`);
          console.log(`  - Project directory handle: ${projectDirHandle ? 'set' : 'missing'}`);
          console.log(`  - Base name: ${autoSaveBaseName || 'missing'}`);
        } else {
          // Auto save is enabled but directory handle or base name is missing
          // Disable auto save and clear interval
          console.warn(`Auto save: Cannot set up interval - missing directory handle (autoSaveDirHandle: ${!!autoSaveDirHandle}, projectDirHandle: ${!!projectDirHandle}) or base name (${!autoSaveBaseName}). Disabling auto save.`);
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
    // Include projectDirHandle as fallback since performAutoSave can use it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, autoSaveInterval, autoSaveDirHandle, autoSaveBaseName, projectDirHandle]);

  // Track changes to project data for auto save
  // Only track changes if auto save is enabled
  // Use a ref to track if this is the first run after enabling auto save
  const isFirstRunAfterEnableRef = useRef<boolean>(false);
  // Use a ref to track if we're currently loading a project (to skip change tracking during load)
  const isLoadingProjectRef = useRef<boolean>(false);
  // Track tool instance changes (colors/sizes) so dirty state updates when tool settings change
  const [toolInstanceVersion, setToolInstanceVersion] = React.useState(0);

  // Subscribe to all tool instances to detect changes for dirty tracking
  React.useEffect(() => {
    const ids = Object.keys(toolInstanceManager.getAll());
    const unsubscribers = ids.map(id => toolInstanceManager.subscribe(id as any, () => {
      setToolInstanceVersion(v => v + 1);
    }));
    return () => unsubscribers.forEach(u => u());
  }, []);
  
  React.useEffect(() => {
    // Skip if we're currently loading a project (loading doesn't count as a change)
    if (isLoadingProjectRef.current) {
      console.log('Change tracking: Skipping - project is being loaded');
      return;
    }
    
    // Skip on first run after enabling auto-save (initial save is handled by enable action)
    if (autoSaveEnabled && isFirstRunAfterEnableRef.current) {
      isFirstRunAfterEnableRef.current = false;
      console.log('Auto save: Skipping change tracking on first run after enable (initial save handled separately)');
      return;
    }
    
    // Track changes regardless of auto-save status
    // This effect triggers when any of the dependencies change, including:
    // - componentsTop/componentsBottom (when components are added/modified/deleted)
    // - drawingStrokes (when traces, vias, pads, etc. are added/modified/deleted)
    // - powers/grounds (when power/ground symbols are added/modified/deleted)
    // - powerBuses (when power buses are added/modified/deleted)
    // - projectNotes (when notes are added/modified/deleted)
    // - topImage/bottomImage (when images are loaded/transformed)
    // - Various lock states and tool settings
    hasChangesSinceLastAutoSaveRef.current = true;
    // Mark as having unsaved changes (will show yellow if auto-save enabled, red if disabled)
    setHasUnsavedChangesState(true);
    console.log('Change detected, marking as unsaved', {
      autoSaveEnabled,
      topImage: !!topImage,
      bottomImage: !!bottomImage,
      drawingStrokesCount: drawingStrokes.length,
      componentsTopCount: componentsTop.length,
      componentsBottomCount: componentsBottom.length,
      powersCount: powers.length,
      groundsCount: grounds.length,
      powerBusesCount: powerBuses.length,
      projectNotesCount: projectNotes.length,
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
    componentsTop, // Triggers auto-save when components are added/modified/deleted
    componentsBottom, // Triggers auto-save when components are added/modified/deleted
    powers,
    grounds,
    powerBuses,
    projectNotes,
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
    groundBuses,
    autoSaveEnabled, // Need to include this to check if enabled, but we skip on first run
    topPadColor,
    bottomPadColor,
    topPadSize,
    bottomPadSize,
    topComponentColor,
    bottomComponentColor,
    topComponentSize,
    bottomComponentSize,
    topTestPointColor,
    bottomTestPointColor,
    topTestPointSize,
    bottomTestPointSize,
    componentConnectionColor,
    componentConnectionSize,
    traceToolLayer,
    autoAssignDesignators,
    useGlobalDesignatorCounters,
    homeViews,
    toolRegistry,
    toolInstanceVersion,
  ]);
  
  // Mark first run when auto save is enabled
  React.useEffect(() => {
    if (autoSaveEnabled) {
      isFirstRunAfterEnableRef.current = true;
      console.log('Auto save: Enabled, marking first run');
      // Don't change indicator state here - it will be set when changes are detected or when saved
    } else {
      isFirstRunAfterEnableRef.current = false;
      // Don't change indicator state when auto-save is disabled - keep current state
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

  // Note: Project name is now loaded from project file only, not from localStorage
  // This prevents project name leakage between projects

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
    
    // Check if directory picker is available (Electron or browser)
    if (isElectron() || typeof w.showDirectoryPicker === 'function') {
      try {
        // Get the parent directory handle
        // Use Electron's native dialog if running in Electron
        let locationHandle: any;
        if (isElectron()) {
          locationHandle = await electronShowDirectoryPicker();
        } else {
          locationHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
        }
        
        // Try to get a display name for the path
        // In Electron, we can get the full path; in browser, just the folder name
        const displayPath = locationHandle.path || locationHandle.name || 'Selected folder';
        
        // Store the handle and update the dialog
        setNewProjectSetupDialog(prev => ({
          ...prev,
          locationHandle,
          locationPath: displayPath,
        }));
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
    
    if (!newProjectSetupDialog.locationHandle) {
      alert('Please select a location for the project.');
      return;
    }
    
    const result = await createNewProject(
      projectNameInput,
      newProjectSetupDialog.locationHandle,
      ensureProjectIsolationCallback,
      setProjectName,
      setProjectDirHandle,
      setCurrentProjectFilePath,
      projectDirHandleRef,
      buildProjectData,
      initializeApplicationDefaults,
      resetView,
      setIsBottomView,
      setTransparency,
      async (interval: number, projectNameParam: string, projectDirHandleParam: FileSystemDirectoryHandle | null, closePromptDialog: boolean) => {
        await configureAutoSave(
          interval,
          projectNameParam,
          projectDirHandleParam,
          setAutoSaveEnabled,
          setAutoSaveInterval,
          setAutoSaveDirHandle,
          setAutoSaveBaseName,
          autoSaveDirHandleRef,
          autoSaveBaseNameRef,
          autoSaveIntervalRef,
          hasChangesSinceLastAutoSaveRef,
          setAutoSaveDialog,
          setAutoSavePromptDialog,
          setProjectDirHandle,
          performAutoSaveRef,
          closePromptDialog
        );
      }
    );
    
    if (!result.success) {
      if (result.error) {
        alert(result.error);
      }
      return;
    }
    
    // Close the dialog
    setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
    
    console.log(`New project created successfully: ${result.projectName}/${result.projectFileName}`);
  }, [newProjectSetupDialog, ensureProjectIsolationCallback, setProjectName, setProjectDirHandle, setCurrentProjectFilePath, projectDirHandleRef, buildProjectData, initializeApplicationDefaults, resetView, setIsBottomView, setTransparency, projectName, projectDirHandle, setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveDirHandle, setAutoSaveBaseName, autoSaveDirHandleRef, autoSaveBaseNameRef, autoSaveIntervalRef, hasChangesSinceLastAutoSaveRef, setAutoSaveDialog, setAutoSavePromptDialog, performAutoSaveRef]);

  // Handle canceling new project setup
  const handleNewProjectSetupCancel = useCallback(() => {
    setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
  }, []);

  // Save As dialog removed - feature no longer supported

  // Handle browsing for Save As location
  const handleSaveAsBrowseLocation = useCallback(async () => {
    const w = window as any;
    if (isElectron() || typeof w.showDirectoryPicker === 'function') {
      try {
        let locationHandle: any;
        if (isElectron()) {
          locationHandle = await electronShowDirectoryPicker();
        } else {
          locationHandle = await w.showDirectoryPicker();
        }
        const displayPath = locationHandle.path || locationHandle.name || 'Selected folder';
        setSaveAsDialog(prev => ({
          ...prev,
          locationHandle,
          locationPath: displayPath,
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
      
      // Extract project name from filename and store it in state (not localStorage)
      const projectNameFromFile = cleanFilename.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (projectNameFromFile) {
        setProjectName(projectNameFromFile);
      }
      
      // Update project directory handle
      setProjectDirHandle(dirHandle);
      
      // Reset save status indicator (project is saved - green)
      setHasUnsavedChangesState(false);
      hasChangesSinceLastAutoSaveRef.current = false;
      
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
  // Optional dirHandle parameter allows passing directory handle directly to avoid race condition
  const loadProject = useCallback(async (project: any, dirHandleOverride?: FileSystemDirectoryHandle | null) => {
    isLoadingProjectRef.current = true;
    try {
      // CRITICAL: Clear ALL project data BEFORE loading new project data
      // This ensures no data from the previous project leaks into the new project
      console.log('loadProject: Clearing all existing project data before loading...');
      setTopImage(null);
      setBottomImage(null);
      setDrawingStrokes([]);
      setVias([]);
      setPads([]);
      setTracesTop([]);
      setTracesBottom([]);
      setCurrentStroke([]);
      currentStrokeRef.current = [];
      setComponentsTop([]);
      setComponentsBottom([]);
      setComponentEditor(null);
      setConnectingPin(null);
      setPowerSymbols([]);
      setGroundSymbols([]);
      setPowerEditor(null);
      setSelectedIds(new Set());
      setSelectedComponentIds(new Set());
      setSelectedPowerIds(new Set());
      setSelectedGroundIds(new Set());
      clearSnapshot();
      
      // Restore tool instances from project data
      if (project.toolInstances) {
        toolInstanceManager.initializeFromProject(project);
      } else {
        // Initialize with defaults if project doesn't have tool instances
        toolInstanceManager.initialize();
      }
      
      // Restore project info (name and directory) if present
      if (project.projectInfo) {
        if (project.projectInfo.name) {
          setProjectName(project.projectInfo.name);
        }
        }
      // Note: Project name is only loaded from project file, not localStorage

      // Restore view state
      if (project.view) {
        if (project.view.currentView) setCurrentView(project.view.currentView);
        if (project.view.viewScale != null) setViewScale(project.view.viewScale);
        // Handle both new format (cameraWorldCenter) and old format (viewPan) for backward compatibility
        if (project.view.cameraWorldCenter) {
          // New format: camera center in world coordinates
          setCameraWorldCenter(project.view.cameraWorldCenter);
        } else if (project.view.viewPan) {
          // Old format: convert viewPan (content area coords) to cameraWorldCenter (world coords)
          const canvas = canvasRef.current;
          if (canvas) {
            // Content area center in content area coordinates (after CONTENT_BORDER translate)
            const contentCenterX = (canvas.width - 2 * CONTENT_BORDER) / 2;
            const contentCenterY = (canvas.height - 2 * CONTENT_BORDER) / 2;
            const viewScale = project.view.viewScale ?? 1;
            // Convert: cameraWorldCenter.x = (contentCenterX - viewPan.x) / viewScale
            const cameraWorldX = (contentCenterX - project.view.viewPan.x) / viewScale;
            const cameraWorldY = (contentCenterY - project.view.viewPan.y) / viewScale;
            setCameraWorldCenter({ x: cameraWorldX, y: cameraWorldY });
          } else {
            // Fallback if canvas not available yet
            setCameraWorldCenter({ x: 0, y: 0 });
          }
        }
        if (project.view.showBothLayers != null) setShowBothLayers(project.view.showBothLayers);
        if (project.view.selectedDrawingLayer) setSelectedDrawingLayer(project.view.selectedDrawingLayer);
      }
      // Restore home views (multiple saved view locations)
      // Migrate old homeViews format to new format with PCB reference position
      if (project.homeViews) {
        const migratedHomeViews: Record<number, HomeView> = {};
        for (const [key, view] of Object.entries(project.homeViews)) {
          const slot = parseInt(key, 10);
          const oldView = view as any;
          
          // Determine PCB reference position
          // If new format has pcbReferenceX/Y, use those
          // Otherwise, if old format has x/y (camera center), use those as PCB reference
          // (This assumes the old format was saving camera center, which we'll treat as PCB reference)
          let pcbRefX = oldView.pcbReferenceX;
          let pcbRefY = oldView.pcbReferenceY;
          if (pcbRefX === undefined || pcbRefY === undefined) {
            // Migrate from old format: use x/y as PCB reference (legacy camera center)
            pcbRefX = oldView.x ?? 0;
            pcbRefY = oldView.y ?? 0;
          }
          
          // Check if this is an old format view (missing layer settings)
          if (oldView.showTopImage === undefined) {
            // Migrate old format: use current layer visibility and view state as defaults
            migratedHomeViews[slot] = {
              pcbReferenceX: pcbRefX,
              pcbReferenceY: pcbRefY,
              x: 0, // Legacy field, always 0 now
              y: 0, // Legacy field, always 0 now
              zoom: oldView.zoom,
              viewRotation: viewRotation, // Use current view rotation
              viewFlipX: viewFlipX, // Use current view flip
              isBottomView: isBottomView, // Use current bottom view state
              transparency: transparency, // Use current transparency
              showTopImage: showTopImage,
              showBottomImage: showBottomImage,
              showViasLayer: showViasLayer,
              showTopTracesLayer: showTopTracesLayer,
              showBottomTracesLayer: showBottomTracesLayer,
              showTopPadsLayer: showTopPadsLayer,
              showBottomPadsLayer: showBottomPadsLayer,
              showTopTestPointsLayer: showTopTestPointsLayer,
              showBottomTestPointsLayer: showBottomTestPointsLayer,
              showTopComponents: showTopComponents,
              showBottomComponents: showBottomComponents,
              showPowerLayer: showPowerLayer,
              showGroundLayer: showGroundLayer,
              showConnectionsLayer: showConnectionsLayer,
            };
          } else {
            // Already in new format, but may be missing new fields
            migratedHomeViews[slot] = {
              ...oldView,
              pcbReferenceX: pcbRefX,
              pcbReferenceY: pcbRefY,
              x: 0, // Legacy field, always 0 now
              y: 0, // Legacy field, always 0 now
              viewRotation: oldView.viewRotation ?? 0,
              viewFlipX: oldView.viewFlipX ?? false,
              isBottomView: oldView.isBottomView ?? false,
              transparency: oldView.transparency ?? 50,
            } as HomeView;
          }
        }
        setHomeViews(migratedHomeViews);
      } else {
        setHomeViews({});
      }
      // Restore project notes
      if (project.projectNotes && Array.isArray(project.projectNotes)) {
        setProjectNotes(project.projectNotes);
      } else {
        setProjectNotes([]);
      }
      // Restore project metadata
      if (project.projectMetadata) {
        setProjectMetadata({
          productName: project.projectMetadata.productName || '',
          modelNumber: (project.projectMetadata as any).modelNumber || (project.projectMetadata as any).productVersion || '',
          manufacturer: project.projectMetadata.manufacturer || '',
          dateManufactured: (project.projectMetadata as any).dateManufactured || (project.projectMetadata as any).date || new Date().toISOString().split('T')[0],
        });
      } else {
        // Initialize with current date if no metadata exists
        setProjectMetadata({
          productName: '',
          modelNumber: '',
          manufacturer: '',
          dateManufactured: new Date().toISOString().split('T')[0],
        });
      }
      // Restore troubleshooting results
      if ((project as any).troubleshootingResults) {
        setTroubleshootingResults((project as any).troubleshootingResults);
      } else {
        setTroubleshootingResults(null);
      }
      // Restore node properties (optional fields for hybrid netlist)
      if ((project as any).nodeProperties) {
        setNodeProperties(deserializeNodeProperties((project as any).nodeProperties));
      } else {
        setNodeProperties(new Map());
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
      // Load tool layer defaults (new format) or migrate from old format
      if (project.toolLayerDefaults) {
        // New format: load all tool layer defaults
        if (project.toolLayerDefaults.trace) setTraceToolLayer(project.toolLayerDefaults.trace);
        if (project.toolLayerDefaults.pad) setPadToolLayer(project.toolLayerDefaults.pad);
        if (project.toolLayerDefaults.testPoint) setTestPointToolLayer(project.toolLayerDefaults.testPoint);
        if (project.toolLayerDefaults.component) setComponentToolLayer(project.toolLayerDefaults.component);
      } else if (project.traceToolLayer) {
        // Old format: migrate traceToolLayer to new format
        setTraceToolLayer(project.traceToolLayer);
        // Other tools default to 'top' (already set by initial state)
      }
      // Note: The useEffect hooks will automatically apply the default layer and update brush color/size
      // when the tool becomes active, so we don't need to handle that here
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
          // Restore test point settings if present
          if (project.testPointSizes && project.testPointColors) {
            setTopTestPointColor(project.testPointColors.top || topTestPointColor);
            setBottomTestPointColor(project.testPointColors.bottom || bottomTestPointColor);
            setTopTestPointSize(project.testPointSizes.top || topTestPointSize);
            setBottomTestPointSize(project.testPointSizes.bottom || bottomTestPointSize);
            
            // Also update tool registry for testPoint
            const testPointDef = updated.get('testPoint');
            if (testPointDef) {
              const layerSettings = new Map(testPointDef.layerSettings);
              layerSettings.set('top', { 
                color: project.testPointColors.top || testPointDef.layerSettings.get('top')?.color || '#E69F00', 
                size: project.testPointSizes.top || testPointDef.layerSettings.get('top')?.size || 6 
              });
              layerSettings.set('bottom', { 
                color: project.testPointColors.bottom || testPointDef.layerSettings.get('bottom')?.color || '#F0E442', 
                size: project.testPointSizes.bottom || testPointDef.layerSettings.get('bottom')?.size || 6 
              });
              updated.set('testPoint', { ...testPointDef, layerSettings });
            }
          }
          // Restore component connection settings if present
          if (project.componentConnectionColor !== undefined) {
            setComponentConnectionColor(project.componentConnectionColor);
          }
          if (project.componentConnectionSize !== undefined) {
            setComponentConnectionSize(project.componentConnectionSize);
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
            if (currentTool === 'draw' && drawingMode === 'testPoint') return updated.get('testPoint');
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
            } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
              const layer = testPointToolLayer || 'top';
              const layerSettings = currentToolDef.layerSettings.get(layer);
              if (layerSettings) {
                setBrushColor(layerSettings.color);
                setBrushSize(layerSettings.size);
                if (layer === 'top') {
                  setTopTestPointColor(layerSettings.color);
                  setTopTestPointSize(layerSettings.size);
                } else {
                  setBottomTestPointColor(layerSettings.color);
                  setBottomTestPointSize(layerSettings.size);
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
        // Loads image from file path in images/ subdirectory
        const buildImage = async (img: any, dirHandle: FileSystemDirectoryHandle | null): Promise<PCBImage | null> => {
          if (!img) return null;
          let bitmap: ImageBitmap | null = null;
          let url = '';
          let filePath = img.filePath || img.name;
          
          // Ensure we have a project directory handle
          if (!dirHandle) {
            const imageName = img.name || 'image';
            alert(`Error: Cannot load image "${imageName}" because no project directory is available.\n\nPlease ensure you opened the project file from its project directory. The project directory is required to access the image files stored in the images/ subdirectory.`);
            return null;
          }
          
          // Try to load from file path (should be in images/ subdirectory)
          if (filePath) {
            try {
              // Handle both old format (just filename or Images/filename) and new format (images/filename)
              let fileName = filePath;
              if (!filePath.startsWith('images/') && !filePath.startsWith('Images/')) {
                // Old format - try images/ subdirectory first
                fileName = filePath;
              } else if (filePath.startsWith('Images/')) {
                // Handle old capitalized format - convert to lowercase
                fileName = filePath.replace('Images/', '');
              } else if (filePath.startsWith('images/')) {
                fileName = filePath.replace('images/', '');
              }
              
              // Access nested directory: get images/ directory first, then the file
              // Try lowercase first (current format), fall back to capitalized if needed
              let imagesDirHandle: FileSystemDirectoryHandle;
              try {
                imagesDirHandle = await dirHandle.getDirectoryHandle('images');
              } catch (e) {
                // Fall back to capitalized if lowercase doesn't exist
                try {
                  imagesDirHandle = await dirHandle.getDirectoryHandle('Images');
                } catch (e2) {
                  throw new Error(`Neither 'images' nor 'Images' directory found in project folder.`);
                }
              }
              
              const fileHandle = await imagesDirHandle.getFileHandle(fileName);
              const file = await fileHandle.getFile();
              bitmap = await createImageBitmap(file);
              url = URL.createObjectURL(file);
              console.log(`Loaded image from file path: images/${fileName}`);
              // Update filePath to use images/ prefix (lowercase) if it wasn't already
              if (!filePath.startsWith('images/')) {
                filePath = `images/${filePath.replace('Images/', '')}`;
              }
            } catch (e) {
              const errorDetails = e instanceof Error ? e.message : 'Unknown error';
              const imageName = img.name || 'image';
              const suggestedPath = filePath.startsWith('images/') || filePath.startsWith('Images/') ? filePath.replace('Images/', 'images/') : `images/${filePath}`;
              alert(`Error: Failed to load image "${imageName}" from project directory.\n\nExpected location: ${suggestedPath}\n\nThis may occur if:\n- The image file was moved or deleted\n- The project directory structure was modified\n- File permissions are insufficient\n\nPlease ensure the image file exists in the images/ subdirectory of your project folder.\n\nTechnical details: ${errorDetails}`);
              return null;
            }
        } else {
          const imageName = img.name || 'image';
          alert(`Error: Image "${imageName}" has no file path specified in the project file.\n\nThe project file is missing the image file path information. This may indicate the project file is corrupted or was created with an older version of the software.`);
          return null;
        }
        
        if (!bitmap) {
          const imageName = img.name || 'image';
          alert(`Error: Could not create image bitmap for "${imageName}".\n\nThe image file may be corrupted or in an unsupported format. Please ensure the image is a valid PNG, JPEG, or other supported image format.`);
          return null;
        }
        
        return {
          url,
          name: img.name ?? 'image',
          width: img.width ?? bitmap.width,
          height: img.height ?? bitmap.height,
          // No dataUrl - images are stored as files
          filePath,
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
          brightness: img.brightness ?? 100,
          contrast: img.contrast ?? 100,
          bitmap,
        };
      };
      // Use provided directory handle if available, otherwise fall back to state
      const dirHandleToUse = dirHandleOverride !== undefined ? dirHandleOverride : projectDirHandle;
      
      // Clean up old image resources before loading new ones
      if (topImage) {
        cleanupImageResources(topImage);
      }
      if (bottomImage) {
        cleanupImageResources(bottomImage);
      }
      // Clear keystone cache when loading new project
      keystoneCacheRef.current.clear();
      
      const newTop = await buildImage(project.images?.top, dirHandleToUse);
      const newBottom = await buildImage(project.images?.bottom, dirHandleToUse);
      setTopImage(newTop);
      setBottomImage(newBottom);

      // Restore point ID counter from saved value (will be validated after all data is loaded)
      // We'll set it initially, then recalculate based on actual max ID after loading all elements
      if (project.pointIdCounter && typeof project.pointIdCounter === 'number') {
        setPointIdCounter(project.pointIdCounter);
      } else {
        // Project file is missing pointIdCounter - start from 1
        // This should only happen with very old/corrupted project files
        console.warn('Project file missing pointIdCounter. Starting from 1.');
        setPointIdCounter(1);
      }
      
      // Restore lock states if present
      if (project.locks) {
        if (typeof project.locks.areImagesLocked === 'boolean') setAreImagesLocked(project.locks.areImagesLocked);
        if (typeof project.locks.areViasLocked === 'boolean') setAreViasLocked(project.locks.areViasLocked);
        if (typeof project.locks.arePadsLocked === 'boolean') setArePadsLocked(project.locks.arePadsLocked);
        if (typeof project.locks.areTracesLocked === 'boolean') setAreTracesLocked(project.locks.areTracesLocked);
        if (typeof project.locks.areComponentsLocked === 'boolean') setAreComponentsLocked(project.locks.areComponentsLocked);
        if (typeof project.locks.areGroundNodesLocked === 'boolean') setAreGroundNodesLocked(project.locks.areGroundNodesLocked);
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
        if (typeof project.visibility.showTraceCornerDots === 'boolean') setShowTraceCornerDots(project.visibility.showTraceCornerDots);
        if (typeof project.visibility.showTraceEndDots === 'boolean') setShowTraceEndDots(project.visibility.showTraceEndDots);
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

      // Restore drawing strokes
      if (project.drawing?.drawingStrokes && Array.isArray(project.drawing.drawingStrokes)) {
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
        
        // Register all existing point IDs to prevent duplicate allocation
        for (const stroke of validStrokes) {
          for (const point of stroke.points) {
            if (point.id && typeof point.id === 'number') {
              registerAllocatedId(point.id);
            }
          }
        }
      } else {
        // Project file is missing drawingStrokes - start with empty strokes
        console.warn('Project file missing drawingStrokes. Starting with empty strokes.');
        setDrawingStrokes([]);
      }
      // Load components if present
      if (project.drawing?.componentsTop) {
        const compsTop = (project.drawing.componentsTop as PCBComponent[]).map(comp => {
          const truncatedPos = truncatePoint({ x: comp.x, y: comp.y });
          const restoredComp = {
            ...comp,
            x: truncatedPos.x,
            y: truncatedPos.y,
            layer: comp.layer || 'top',
            pinConnections: comp.pinConnections || new Array(comp.pinCount || 0).fill(''),
          };
          
          // CRITICAL: Ensure componentDefinitionKey is preserved
          // The spread operator should preserve it, but if missing, try to resolve it
          // This handles cases where old project files don't have the key
          if (!(restoredComp as any).componentDefinitionKey) {
            const def = resolveComponentDefinition(restoredComp as any);
            if (def) {
              (restoredComp as any).componentDefinitionKey = `${def.category}:${def.subcategory}`;
            }
          }
          
          return restoredComp;
        });
        setComponentsTop(compsTop);
        
        // Register component pinConnection IDs to prevent duplicate allocation
        for (const comp of compsTop) {
          if (comp.pinConnections && Array.isArray(comp.pinConnections)) {
            for (const conn of comp.pinConnections) {
              if (conn && typeof conn === 'string' && conn.trim() !== '') {
                const nodeId = parseInt(conn.trim(), 10);
                if (!isNaN(nodeId) && nodeId > 0) {
                  registerAllocatedId(nodeId);
                }
              }
            }
          }
        }
      }
      if (project.drawing?.componentsBottom) {
        const compsBottom = (project.drawing.componentsBottom as PCBComponent[]).map(comp => {
          const truncatedPos = truncatePoint({ x: comp.x, y: comp.y });
          const restoredComp = {
            ...comp,
            x: truncatedPos.x,
            y: truncatedPos.y,
            layer: comp.layer || 'bottom',
            pinConnections: comp.pinConnections || new Array(comp.pinCount || 0).fill(''),
          };
          
          // CRITICAL: Ensure componentDefinitionKey is preserved
          // The spread operator should preserve it, but if missing, try to resolve it
          // This handles cases where old project files don't have the key
          if (!(restoredComp as any).componentDefinitionKey) {
            const def = resolveComponentDefinition(restoredComp as any);
            if (def) {
              (restoredComp as any).componentDefinitionKey = `${def.category}:${def.subcategory}`;
            }
          }
          
          return restoredComp;
        });
        setComponentsBottom(compsBottom);
        
        // Register component pinConnection IDs to prevent duplicate allocation
        for (const comp of compsBottom) {
          if (comp.pinConnections && Array.isArray(comp.pinConnections)) {
            for (const conn of comp.pinConnections) {
              if (conn && typeof conn === 'string' && conn.trim() !== '') {
                const nodeId = parseInt(conn.trim(), 10);
                if (!isNaN(nodeId) && nodeId > 0) {
                  registerAllocatedId(nodeId);
                }
              }
            }
          }
        }
      }
      
      // Restore designator counters from project file
      if (project.designatorCounters && typeof project.designatorCounters === 'object') {
        const savedCounters = project.designatorCounters as Record<string, number>;
        sessionDesignatorCountersRef.current = { ...savedCounters };
      } else {
        // Project file missing designator counters - start with empty counters
        sessionDesignatorCountersRef.current = {};
      }
      
      // Restore auto-designator assignment setting (no localStorage)
      if (typeof project.autoAssignDesignators === 'boolean') {
        setAutoAssignDesignators(project.autoAssignDesignators);
      }
      
      // Restore global designator counter setting (default to false/OFF)
      if (typeof project.useGlobalDesignatorCounters === 'boolean') {
        setUseGlobalDesignatorCounters(project.useGlobalDesignatorCounters);
      } else {
        setUseGlobalDesignatorCounters(false); // Default to OFF
      }
      
      // Load ground symbols
      if (project.drawing?.grounds) {
        const loadedGrounds = project.drawing.grounds as GroundSymbol[];
        // Filter out ground symbols with invalid coordinates
        const validGrounds = loadedGrounds
          .map(g => {
            if (!g.pointId) {
              console.warn('Ground symbol missing pointId - this may cause issues');
            }
            const truncatedPos = truncatePoint({ x: g.x, y: g.y });
            return { ...g, x: truncatedPos.x, y: truncatedPos.y };
          })
          .filter(g => {
            // Allow negative coordinates (valid in world coordinates)
            const isValid = typeof g.x === 'number' && typeof g.y === 'number' && 
                           !isNaN(g.x) && !isNaN(g.y) &&
                           isFinite(g.x) && isFinite(g.y);
            if (!isValid) {
              console.warn(`Filtered out invalid ground symbol at (${g.x}, ${g.y})`);
            }
            return isValid;
          });
        setGroundSymbols(validGrounds);
        
        // Register ground symbol IDs
        for (const ground of validGrounds) {
          if (ground.pointId && typeof ground.pointId === 'number') {
            registerAllocatedId(ground.pointId);
      }
        }
      } else {
        // Initialize empty array if project doesn't have ground symbols
        setGroundSymbols([]);
      }
      
      // Load power buses
      let loadedPowerBuses: PowerBus[];
      if (project.powerBuses && Array.isArray(project.powerBuses) && project.powerBuses.length > 0) {
        loadedPowerBuses = project.powerBuses as PowerBus[];
        setPowerBuses(loadedPowerBuses);
      } else {
        // Use default power bus if project doesn't have any
        loadedPowerBuses = [
          { id: 'powerbus-default', name: '+5VDC', voltage: '+5', color: '#ff0000' },
        ];
        setPowerBuses(loadedPowerBuses);
      }
      
      // Load ground buses
      if (project.groundBuses && Array.isArray(project.groundBuses) && project.groundBuses.length > 0) {
        setGroundBuses(project.groundBuses as GroundBus[]);
      } else {
        // Use default ground bus if project doesn't have any
        setGroundBuses([
          { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
        ]);
      }
      
      // Load power symbols
      if (project.drawing?.powers) {
        const loadedPowers = project.drawing.powers as PowerSymbol[];
        // Filter out power nodes with invalid coordinates
        const validPowers = loadedPowers
          .map(p => {
            if (!p.pointId) {
              console.warn('Power symbol missing pointId - this may cause issues');
            }
            const truncatedPos = truncatePoint({ x: p.x, y: p.y });
            return { ...p, x: truncatedPos.x, y: truncatedPos.y };
          })
          .filter(p => {
            // Allow negative coordinates (valid in world coordinates)
            const isValid = typeof p.x === 'number' && typeof p.y === 'number' && 
                           !isNaN(p.x) && !isNaN(p.y) &&
                           isFinite(p.x) && isFinite(p.y);
            if (!isValid) {
              console.warn(`Filtered out invalid power node at (${p.x}, ${p.y})`);
            }
            return isValid;
          });
        setPowerSymbols(validPowers);
        
        // Register power symbol IDs
        for (const power of validPowers) {
          if (power.pointId && typeof power.pointId === 'number') {
            registerAllocatedId(power.pointId);
          }
        }
      } else {
        // Initialize empty array if project doesn't have power symbols
        setPowerSymbols([]);
      }
      
      // Validate and correct pointIdCounter after all elements are loaded
      // This ensures the counter is always >= max(existing IDs) + 1
      // This fixes cases where pointIdCounter was incorrectly saved as 1
      let maxId = 0;
      
      // Check all drawing stroke points
      if (project.drawing?.drawingStrokes && Array.isArray(project.drawing.drawingStrokes)) {
        for (const stroke of project.drawing.drawingStrokes as DrawingStroke[]) {
          for (const point of stroke.points) {
            if (point.id && typeof point.id === 'number' && point.id > maxId) {
              maxId = point.id;
            }
          }
        }
      }
      
      // Check all component pin connections (they reference point IDs as strings)
      if (project.drawing?.componentsTop && Array.isArray(project.drawing.componentsTop)) {
        for (const comp of project.drawing.componentsTop as PCBComponent[]) {
          if (comp.pinConnections && Array.isArray(comp.pinConnections)) {
            for (const conn of comp.pinConnections) {
              if (conn && typeof conn === 'string') {
                const id = parseInt(conn, 10);
                if (!isNaN(id) && id > maxId) {
                  maxId = id;
                }
              }
            }
          }
        }
      }
      if (project.drawing?.componentsBottom && Array.isArray(project.drawing.componentsBottom)) {
        for (const comp of project.drawing.componentsBottom as PCBComponent[]) {
          if (comp.pinConnections && Array.isArray(comp.pinConnections)) {
            for (const conn of comp.pinConnections) {
              if (conn && typeof conn === 'string') {
                const id = parseInt(conn, 10);
                if (!isNaN(id) && id > maxId) {
                  maxId = id;
                }
              }
            }
          }
        }
      }
      
      // Check all ground symbols
      if (project.drawing?.grounds && Array.isArray(project.drawing.grounds)) {
        for (const ground of project.drawing.grounds as GroundSymbol[]) {
          if (ground.pointId && typeof ground.pointId === 'number' && ground.pointId > maxId) {
            maxId = ground.pointId;
          }
        }
      }
      
      // Check all power symbols
      if (project.drawing?.powers && Array.isArray(project.drawing.powers)) {
        for (const power of project.drawing.powers as PowerSymbol[]) {
          if (power.pointId && typeof power.pointId === 'number' && power.pointId > maxId) {
            maxId = power.pointId;
          }
        }
      }
      
      // Update counter to max+1 if the saved counter is too low
      const correctCounter = maxId + 1;
      const currentCounter = getPointIdCounter();
      if (currentCounter < correctCounter) {
        console.warn(`pointIdCounter was ${currentCounter} but max existing ID is ${maxId}. Correcting to ${correctCounter}.`);
        setPointIdCounter(correctCounter);
      }
      
      // Reset change tracking for auto save after loading project
      hasChangesSinceLastAutoSaveRef.current = false;
      // Reset save status indicator (project is loaded and saved - green)
      setHasUnsavedChangesState(false);
      // Reset transform all view state
      setIsBottomView(false);
      // Clear the loading flag after a short delay to ensure all state updates have completed
      // Use setTimeout to ensure this happens after all state updates from loadProject have propagated
      setTimeout(() => {
        isLoadingProjectRef.current = false;
      }, 100);
    } catch (err) {
      console.error('Failed to open project', err);
      alert('Failed to open project file. See console for details.');
      // Clear the loading flag even on error
      isLoadingProjectRef.current = false;
    }
  }, [currentTool, drawingMode, projectDirHandle, setTopImage, setBottomImage, setPointIdCounter, setAreImagesLocked, setAreViasLocked, setArePadsLocked, setAreTracesLocked, setAreComponentsLocked, setAreGroundNodesLocked, setArePowerNodesLocked, setShowViasLayer, setShowTopPadsLayer, setShowBottomPadsLayer, setShowTopTracesLayer, setShowBottomTracesLayer, setShowTopComponents, setShowBottomComponents, setShowPowerLayer, setShowGroundLayer, setShowConnectionsLayer, setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveDirHandle, setAutoSaveBaseName, setDrawingStrokes, setComponentsTop, setComponentsBottom, setGroundSymbols, setPowerBuses, setGroundBuses, setPowerSymbols, generatePointId, truncatePoint, getDefaultPrefix, saveDesignatorCounters, loadDesignatorCounters, setAutoAssignDesignators, setUseGlobalDesignatorCounters, clearSnapshot]);

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
      // Clear save status indicator when project is loaded from history (project is saved - green)
      setHasUnsavedChangesState(false);
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

  // Function to restore a file from history directory (PastMachine)
  const restoreFileFromHistory = useCallback(async (fileName: string) => {
    if (!projectDirHandle) {
      console.warn('Cannot restore file: no project directory handle');
      alert('No project directory available. Please open or create a project first.');
      return;
    }
    
    try {
      // Get history directory
      let historyDirHandle: FileSystemDirectoryHandle;
      try {
        historyDirHandle = await projectDirHandle.getDirectoryHandle('history');
      } catch (e) {
        console.error('History directory not found:', e);
        alert('History directory not found.');
        return;
      }

      // Get the file from history directory
      const fileHandle = await historyDirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      
      // Check if file is empty
      if (file.size === 0) {
        alert(`File ${fileName} is empty.`);
        return;
      }
      
      const text = await file.text();
      
      // Check if text is empty or whitespace only
      if (!text || text.trim().length === 0) {
        alert(`File ${fileName} contains no data.`);
        return;
      }
      
      let project;
      try {
        project = JSON.parse(text);
      } catch (parseError) {
        console.error(`Failed to parse JSON from file ${fileName}:`, parseError);
        alert(`Failed to parse file ${fileName}. It may be corrupted.`);
        return;
      }
      
      // Call initialization BEFORE loading project to prevent visual flash
      initializeApplicationDefaults();
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
      // Also call full initialization for pan calculation
      initializeApplication();
      
      await loadProject(project);
      
      // Update current project file path to reflect the restored file
      setCurrentProjectFilePath(fileName);
      
      // Reset change tracking since we loaded a saved file
      hasChangesSinceLastAutoSaveRef.current = false;
      
      console.log(`Successfully restored file: ${fileName}`);
    } catch (e) {
      console.error('Failed to restore file from history:', e);
      alert(`Failed to restore file ${fileName}. Please try again.`);
    }
  }, [projectDirHandle, loadProject, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds, setCurrentProjectFilePath, setViewScale, initializeApplicationDefaults, initializeApplication]);

  // Initialize PastMachine dialog position when it opens
  React.useEffect(() => {
    if (showPastMachine && !pastMachinePosition) {
      // Center the dialog on screen
      setPastMachinePosition({
        x: window.innerWidth / 2 - 300,
        y: window.innerHeight / 2 - 250,
      });
    }
  }, [showPastMachine, pastMachinePosition]);

  // Drag handlers for PastMachine dialog
  const handlePastMachineDragStart = useCallback((e: React.MouseEvent) => {
    if (!pastMachinePosition) {
      return;
    }
    setIsDraggingPastMachine(true);
    const startX = e.clientX - pastMachinePosition.x;
    const startY = e.clientY - pastMachinePosition.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPastMachinePosition({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPastMachine(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pastMachinePosition]);

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
  const prevModeRef = React.useRef<'trace' | 'via' | 'pad' | 'testPoint'>(drawingMode);
  const prevLayerRef = React.useRef<'top' | 'bottom'>(selectedDrawingLayer);
  React.useEffect(() => {
    // Only react when mode actually changed; do NOT auto-finalize on layer change
    const modeChanged = drawingMode !== prevModeRef.current;
      if (currentTool === 'draw' && prevModeRef.current === 'trace' && modeChanged) {
      // finalize without losing the current points
      if (currentStrokeRef.current.length >= 2) {
        // Save snapshot before auto-finalizing trace
        saveSnapshot(drawingStrokes, componentsTop, componentsBottom, powerSymbols, groundSymbols);
        
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

  // Finalize in-progress trace when switching away from draw tool
  const prevToolRef = React.useRef<Tool>(currentTool);
  React.useEffect(() => {
    // If switching away from draw tool and there's an incomplete trace, finalize it
    if (prevToolRef.current === 'draw' && currentTool !== 'draw' && drawingMode === 'trace' && currentStrokeRef.current.length >= 2) {
      const newStroke: DrawingStroke = {
        id: `${Date.now()}-trace-autofinalize`,
        points: currentStrokeRef.current,
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
      setCurrentStroke([]);
      setIsDrawing(false);
    }
    prevToolRef.current = currentTool;
  }, [currentTool, drawingMode, brushColor, brushSize, selectedDrawingLayer]);

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
  // Organized by color family, arranged light to dark within each family
  const palette8x8 = React.useMemo(() => COLOR_PALETTE, []);

  // Force redraw when drawingStrokes change (for eraser)
  React.useEffect(() => {
    drawCanvas();
  }, [drawingStrokes]);
  // Redraw when components change (add/remove/edit)
  React.useEffect(() => {
    drawCanvas();
  }, [componentsTop, componentsBottom, grounds, showGroundLayer]);


  // Determine if we're in read-only mode (viewing file history, not the most recent file)
  const isReadOnlyMode = currentFileIndex > 0;

  // Internal function to perform the actual project opening (called after user confirms or has no unsaved changes)
  // Internal function to perform the actual project opening with a pre-selected directory handle
  const performOpenProjectWithHandle = useCallback(async (preSelectedDirHandle: FileSystemDirectoryHandle | null) => {
    // Create a wrapper function for configureAutoSave that matches the expected signature
    // Now accepts projectName and projectDirHandle as parameters to avoid timing issues with state updates
    const configureAutoSaveWrapper = async (interval: number, projectNameParam: string, projectDirHandleParam: FileSystemDirectoryHandle | null, closePromptDialog: boolean) => {
      await configureAutoSave(
        interval,
        projectNameParam,
        projectDirHandleParam,
        setAutoSaveEnabled,
        setAutoSaveInterval,
        setAutoSaveDirHandle,
        setAutoSaveBaseName,
        autoSaveDirHandleRef,
        autoSaveBaseNameRef,
        autoSaveIntervalRef,
        hasChangesSinceLastAutoSaveRef,
        setAutoSaveDialog,
        setAutoSavePromptDialog,
        setProjectDirHandle,
        performAutoSaveRef,
        closePromptDialog
      );
    };

    const result = await openProject(
      ensureProjectIsolationCallback,
      setProjectDirHandle,
      setCurrentProjectFilePath,
      setProjectName,
      projectDirHandleRef,
      isOpeningProjectRef,
      loadProject,
      configureAutoSaveWrapper,
      preSelectedDirHandle
    );
    
    return result;
  }, [ensureProjectIsolationCallback, setProjectDirHandle, setCurrentProjectFilePath, setProjectName, projectDirHandleRef, isOpeningProjectRef, loadProject, setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveDirHandle, setAutoSaveBaseName, autoSaveDirHandleRef, autoSaveBaseNameRef, autoSaveIntervalRef, hasChangesSinceLastAutoSaveRef, setAutoSaveDialog, setAutoSavePromptDialog, setProjectDirHandle, performAutoSaveRef, configureAutoSave]);

  // Legacy function - kept for reference, replaced by handleOpenProject
  const _performOpenProject = useCallback(async () => {
    // Create a wrapper function for configureAutoSave that matches the expected signature
    // Now accepts projectName and projectDirHandle as parameters to avoid timing issues with state updates
    const configureAutoSaveWrapper = async (interval: number, projectNameParam: string, projectDirHandleParam: FileSystemDirectoryHandle | null, closePromptDialog: boolean) => {
      await configureAutoSave(
        interval,
        projectNameParam,
        projectDirHandleParam,
        setAutoSaveEnabled,
        setAutoSaveInterval,
        setAutoSaveDirHandle,
        setAutoSaveBaseName,
        autoSaveDirHandleRef,
        autoSaveBaseNameRef,
        autoSaveIntervalRef,
        hasChangesSinceLastAutoSaveRef,
        setAutoSaveDialog,
        setAutoSavePromptDialog,
        setProjectDirHandle,
        performAutoSaveRef,
        closePromptDialog
      );
    };

    const result = await openProject(
      ensureProjectIsolationCallback,
      setProjectDirHandle,
      setCurrentProjectFilePath,
      setProjectName,
      projectDirHandleRef,
      isOpeningProjectRef,
      loadProject,
      configureAutoSaveWrapper
    );
    
    if (!result.success) {
      if (result.error && result.error !== 'User cancelled directory selection.') {
        alert(result.error);
      }
      // If user cancelled, don't show an alert
      if (result.error === 'User cancelled directory selection.') {
        return;
      }
      // Fallback to file input if directory picker is not supported
      if (result.error?.includes('not supported')) {
        openProjectRef.current?.click();
      }
    }
  }, [ensureProjectIsolationCallback, setProjectDirHandle, setCurrentProjectFilePath, setProjectName, projectDirHandleRef, isOpeningProjectRef, loadProject, projectName, projectDirHandle, setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveDirHandle, setAutoSaveBaseName, autoSaveDirHandleRef, autoSaveBaseNameRef, autoSaveIntervalRef, hasChangesSinceLastAutoSaveRef, setAutoSaveDialog, setAutoSavePromptDialog, setProjectDirHandle, performAutoSaveRef, openProjectRef, configureAutoSave]);
  // Suppress unused variable warning for legacy function (kept for reference)
  void _performOpenProject;

  // Public handler for opening a project file
  // Shows directory picker first (preserving user gesture), then saves current project, then opens new project
  const handleOpenProject = useCallback(async () => {
    const w = window as any;
    
    // Check if we can show directory picker (either Electron or browser API)
    if (!isElectron() && typeof w.showDirectoryPicker !== 'function') {
      alert('Directory picker is not supported in this browser.');
      return;
    }

    let selectedDirHandle: FileSystemDirectoryHandle | null = null;
    
    try {
      // Show directory picker FIRST to preserve user gesture
      // Use Electron's native dialog if running in Electron
      if (isElectron()) {
        selectedDirHandle = await electronShowDirectoryPicker() as any;
      } else {
        selectedDirHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
      }
      
      // Verify we have write access
      try {
        if (selectedDirHandle && 'queryPermission' in selectedDirHandle && typeof (selectedDirHandle as any).queryPermission === 'function') {
          const permission = await (selectedDirHandle as any).queryPermission({ mode: 'readwrite' });
          if (permission !== 'granted') {
            if ('requestPermission' in selectedDirHandle && typeof (selectedDirHandle as any).requestPermission === 'function') {
              const requestResult = await (selectedDirHandle as any).requestPermission({ mode: 'readwrite' });
              if (requestResult !== 'granted') {
                alert('Full access to the project directory is required to open and manage project files.');
                return;
              }
            }
          }
        }
      } catch (permError) {
        console.warn('Permission check failed (may not be supported in this browser):', permError);
        // Continue anyway
      }
      } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        // User cancelled - silently return
        return;
      }
      alert(`Failed to open directory picker: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    // Now save the current project if there are unsaved changes (user gesture is preserved)
    if (hasUnsavedChanges() && projectDirHandle) {
      try {
    await saveProject();
      } catch (e) {
        console.warn('Failed to auto-save before opening project:', e);
        // Continue anyway - user can still open the project
      }
    }

    // Now proceed with opening the new project using the selected directory
    const result = await performOpenProjectWithHandle(selectedDirHandle);
    
    if (!result.success && result.error && result.error !== 'User cancelled directory selection.') {
      alert(result.error);
    }
  }, [hasUnsavedChanges, saveProject, projectDirHandle, performOpenProjectWithHandle]);

  // Public handler for closing a project (saves if there are unsaved changes, then closes and clears all project data)
  const handleCloseProject = useCallback(async () => {
    // Save silently if there are unsaved changes to avoid data loss
    if (hasUnsavedChanges() && projectDirHandle) {
      try {
        await saveProject();
      } catch (e) {
        console.warn('Failed to save before closing project:', e);
        // Continue anyway - user can still close the project
      }
    }
    // Close the project and clear all state
    closeProjectWrapper();
  }, [hasUnsavedChanges, saveProject, projectDirHandle, closeProjectWrapper]);

  // Troubleshooting handlers
  const handleRunTroubleshooting = useCallback(() => {
    setTroubleshootingDialogVisible(true);
  }, []);

  const handleViewTroubleshooting = useCallback(() => {
    setTroubleshootingDialogVisible(true);
  }, []);

  // Handle Net Name Suggestion Dialog
  const handleApplyNetNameSuggestions = useCallback(async (selectedSuggestions: Array<{
    original_name: string;
    suggested_name: string;
    confidence: number;
    reasoning: string;
  }>) => {
    if (!pendingNetlistContent) return;
    
    try {
      const { applyNetNameSuggestions } = await import('./utils/netNameInference');
      const updatedNetlist = applyNetNameSuggestions(pendingNetlistContent, selectedSuggestions);
      
      // Close dialog
      setNetNameSuggestionDialogVisible(false);
      setPendingNetlistContent(null);
      setNetNameSuggestions([]);
      
      // Save the updated netlist
      await saveNetlistToFile(updatedNetlist);
    } catch (error) {
      console.error('[Export] Failed to apply net name suggestions:', error);
      alert('Failed to apply net name suggestions. See console for details.');
    }
  }, [pendingNetlistContent, saveNetlistToFile]);
  
  const handleCancelNetNameSuggestions = useCallback(() => {
    if (!pendingNetlistContent) return;
    
    // User cancelled, save original netlist without AI suggestions
    saveNetlistToFile(pendingNetlistContent);
    
    // Close dialog
    setNetNameSuggestionDialogVisible(false);
    setPendingNetlistContent(null);
    setNetNameSuggestions([]);
  }, [pendingNetlistContent, saveNetlistToFile]);
  
  const handleTroubleshootingAnalysis = useCallback(async (
    selectedSymptomIndices: number[],
    selectedMeasurementIndices: number[],
    includePcbDataFlag: boolean
  ) => {
    setIsAnalyzing(true);
    try {
      const selectedSymptoms = selectedSymptomIndices.map(i => projectNotes[i]).filter(Boolean);
      const selectedMeasurements = selectedMeasurementIndices.map(i => projectNotes[i]).filter(Boolean);
      
      let pcbData: TroubleshootingPcbData | undefined;
      if (includePcbDataFlag) {
        const allComponents = [...componentsTop, ...componentsBottom];
        const testPoints = extractTestPoints(drawingStrokes);
        pcbData = {
          components: allComponents,
          drawingStrokes,
          testPoints,
          powerNodes: powers.map(p => ({ id: p.id, name: powerNodeNames.find(n => n) || p.id, voltage: undefined })),
          groundNodes: grounds.map(g => ({ id: g.id, name: groundNodeNames.find(n => n) || g.id })),
        };
      }
      
      const aiService = getCurrentService();
      const result = await runTroubleshootingAnalysis(
        projectMetadata,
        selectedSymptoms,
        includePcbDataFlag,
        pcbData,
        selectedMeasurements,
        aiService
      );
      
      if (result.success && result.results) {
        setTroubleshootingResults(result.results);
      } else {
        alert(`Troubleshooting analysis failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error running troubleshooting analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectNotes, projectMetadata, componentsTop, componentsBottom, drawingStrokes, powers, grounds, powerNodeNames, groundNodeNames]);

  const handleGetPrompt = useCallback(async (
    selectedSymptomIndices: number[],
    selectedMeasurementIndices: number[],
    includePcbDataFlag: boolean
  ): Promise<string> => {
    const selectedSymptoms = selectedSymptomIndices.map(i => projectNotes[i]).filter(Boolean);
    const selectedMeasurements = selectedMeasurementIndices.map(i => projectNotes[i]).filter(Boolean);
    
    let pcbData: TroubleshootingPcbData | undefined;
    if (includePcbDataFlag) {
      const allComponents = [...componentsTop, ...componentsBottom];
      const testPoints = extractTestPoints(drawingStrokes);
      pcbData = {
        components: allComponents,
        drawingStrokes,
        testPoints,
        powerNodes: powers.map(p => ({ id: p.id, name: powerNodeNames.find(n => n) || p.id, voltage: undefined })),
        groundNodes: grounds.map(g => ({ id: g.id, name: groundNodeNames.find(n => n) || g.id })),
      };
    }
    
    return buildTroubleshootingPromptForPreview(
      projectMetadata,
      selectedSymptoms,
      includePcbDataFlag,
      pcbData,
      selectedMeasurements
    );
  }, [projectNotes, projectMetadata, componentsTop, componentsBottom, drawingStrokes, powers, grounds, powerNodeNames, groundNodeNames]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          🔧 PCB Tracer: <span style={{ fontStyle: 'italic', fontWeight: 400, fontSize: '0.75em' }}>AI-Assisted Troubleshooting</span>
        </h1>
        <a
          href="https://ko-fi.com/onesmallstep"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'linear-gradient(180deg, #9D5CFF 0%, #7C3AED 50%, #5B21B6 100%)',
            color: '#fff',
            border: '1px solid #000',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 3px 0 #3b1a70, 0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.background = 'linear-gradient(180deg, #8B4DFF 0%, #6d2ed4 50%, #4c1d95 100%)';
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.background = 'linear-gradient(180deg, #9D5CFF 0%, #7C3AED 50%, #5B21B6 100%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(calc(-50% + 2px))';
            e.currentTarget.style.boxShadow = '0 1px 0 #3b1a70, 0 2px 3px rgba(0,0,0,0.3)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
            e.currentTarget.style.boxShadow = '0 3px 0 #3b1a70, 0 4px 6px rgba(0,0,0,0.3)';
          }}
          title="Support this project on Ko-fi"
        >
          ☕ Buy me a coffee
        </a>
      </header>

      {/* Application menu bar */}
      <MenuBar
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        isReadOnlyMode={isReadOnlyMode}
        currentProjectFilePath={currentProjectFilePath}
        isProjectActive={!!projectDirHandle}
        autoSaveEnabled={autoSaveEnabled}
        autoSaveInterval={autoSaveInterval}
        hasUnsavedChangesState={hasUnsavedChangesState}
        onNewProject={newProject}
        onOpenProject={handleOpenProject}
        onSaveProject={saveProject}
        onCloseProject={handleCloseProject}
        onPrint={handlePrint}
        onDismissSplash={() => setHasDismissedSplash(true)}
        onExportBOM={handleExportBOM}
        bomExportFormat={bomExportFormat}
        setBomExportFormat={setBomExportFormat}
        onExportNetlist={handleExportNetlist}
        hasUnsavedChanges={hasUnsavedChanges}
        setNewProjectDialog={setNewProjectDialog}
        setAutoSaveDialog={setAutoSaveDialog}
        onShowAiSettings={() => setShowAiSettingsDialog(true)}
        topImage={topImage}
        bottomImage={bottomImage}
        setCurrentTool={setCurrentTool}
        resetImageTransform={resetImageTransform}
        areImagesLocked={areImagesLocked}
        setAreImagesLocked={setAreImagesLocked}
        onEnterBoardDimensions={() => setShowBoardDimensionsDialog(true)}
        fileInputTopRef={fileInputTopRef}
        fileInputBottomRef={fileInputBottomRef}
        openProjectRef={openProjectRef}
        increaseSize={increaseSize}
        decreaseSize={decreaseSize}
        onChangeSize={handleOpenChangeSize}
        onChangeColor={handleOpenChangeColor}
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
        areTestPointsLocked={areTestPointsLocked}
        setAreTestPointsLocked={setAreTestPointsLocked}
        areTracesLocked={areTracesLocked}
        setAreTracesLocked={setAreTracesLocked}
        areComponentsLocked={areComponentsLocked}
        setAreComponentsLocked={setAreComponentsLocked}
        areGroundNodesLocked={areGroundNodesLocked}
        setAreGroundNodesLocked={setAreGroundNodesLocked}
        arePowerNodesLocked={arePowerNodesLocked}
        setArePowerNodesLocked={setArePowerNodesLocked}
        showTraceCornerDots={showTraceCornerDots}
        setShowTraceCornerDots={setShowTraceCornerDots}
        showTraceEndDots={showTraceEndDots}
        setShowTraceEndDots={setShowTraceEndDots}
        showCrosshairs={showCrosshairs}
        setShowCrosshairs={setShowCrosshairs}
        setSelectedIds={setSelectedIds}
        setSelectedComponentIds={setSelectedComponentIds}
        setSelectedPowerIds={setSelectedPowerIds}
        setSelectedGroundIds={setSelectedGroundIds}
        selectAllVias={selectAllVias}
        selectAllTraces={selectAllTraces}
        selectAllPads={selectAllPads}
        selectAllComponents={selectAllComponents}
        selectDisconnectedComponents={selectDisconnectedComponents}
        selectAllComponentConnections={selectAllComponentConnections}
        selectAllPowerNodes={selectAllPowerNodes}
        selectAllGroundNodes={selectAllGroundNodes}
        selectPowerNodesByName={selectPowerNodesByName}
        selectGroundNodesByName={selectGroundNodesByName}
        setShowPowerBusManager={setShowPowerBusManager}
        setShowGroundBusManager={setShowGroundBusManager}
        setShowPastMachine={setShowPastMachine}
        troubleshootingResults={troubleshootingResults}
        onRunTroubleshooting={handleRunTroubleshooting}
        onViewTroubleshooting={handleViewTroubleshooting}
        showMemoryMonitor={showMemoryMonitor}
        setShowMemoryMonitor={setShowMemoryMonitor}
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
        testPointToolLayer={testPointToolLayer}
        componentToolLayer={componentToolLayer}
        setTopTraceSize={setTopTraceSize}
        setBottomTraceSize={setBottomTraceSize}
        setTopPadSize={setTopPadSize}
        setBottomPadSize={setBottomPadSize}
        setTopTestPointSize={setTopTestPointSize}
        setBottomTestPointSize={setBottomTestPointSize}
        setTopComponentSize={setTopComponentSize}
        setBottomComponentSize={setBottomComponentSize}
        setComponentConnectionSize={setComponentConnectionSize}
        topTraceColor={topTraceColor}
        bottomTraceColor={bottomTraceColor}
        topPadColor={topPadColor}
        bottomPadColor={bottomPadColor}
        topTestPointColor={topTestPointColor}
        bottomTestPointColor={bottomTestPointColor}
        topComponentColor={topComponentColor}
        bottomComponentColor={bottomComponentColor}
        setTopTraceColor={setTopTraceColor}
        setBottomTraceColor={setBottomTraceColor}
        setTopPadColor={setTopPadColor}
        setBottomPadColor={setBottomPadColor}
        setTopTestPointColor={setTopTestPointColor}
        setBottomTestPointColor={setBottomTestPointColor}
        setTopComponentColor={setTopComponentColor}
        setBottomComponentColor={setBottomComponentColor}
        setComponentConnectionColor={setComponentConnectionColor}
        saveDefaultSize={saveDefaultSize}
        saveDefaultColor={saveDefaultColor}
        menuBarRef={menuBarRef}
        onOpenProjectNotes={handleOpenProjectNotes}
        onOpenTestPoints={handleOpenTestPoints}
        onOpenTransformImages={() => setTransformImagesDialogVisible(true)}
        onOpenTransformAll={() => setTransformAllDialogVisible(true)}
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
              onMouseDown={(e) => {
                if (e.altKey && !isReadOnlyMode) {
                  // Option+click: open IC placement dialog
                  e.preventDefault();
                  e.stopPropagation();
                  setICPlacementIsPad(false);
                  setShowICPlacementDialog(true);
                  return;
                }
              }}
              onClick={(e) => { 
                if (!isReadOnlyMode && !e.altKey) { 
                  console.log('Via tool clicked');
                  clearAllSelections(); // Clear all selections when tool is selected
                  setDrawingMode('via'); 
                  setCurrentTool('draw');
                  setShowViasLayer(true); // Automatically enable vias layer visibility 
                } 
              }} 
              disabled={isReadOnlyMode}
              title="Draw Vias (V), Option+click for Pattern Placement" 
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
                  // Use tool instance directly (single source of truth) to match cursor color
                  const viaColor = toolInstanceManager.get('via').color;
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
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolInstanceManager.get('via').size}</span>
              </div>
            </button>
            <button 
              ref={padButtonRef}
              onMouseDown={(e) => {
                if (e.altKey && !isReadOnlyMode) {
                  // Option+click: open IC placement dialog
                  e.preventDefault();
                  e.stopPropagation();
                  setICPlacementIsPad(true);
                  setShowICPlacementDialog(true);
                  return;
                }
              }}
              onClick={(e) => { 
                if (!isReadOnlyMode && !e.altKey) { 
                  console.log('Pad tool clicked');
                  clearAllSelections(); // Clear all selections when tool is selected
                  setDrawingMode('pad'); 
                  setCurrentTool('draw'); 
                  // The useEffect hook will automatically apply the default layer and show the layer chooser
                  // Force position recalculation on every click, even if dialog is already visible
                  setTimeout(() => updatePadChooserPosition(), 0);
                } 
              }} 
              disabled={isReadOnlyMode}
              title="Draw Pads (P), Option+click for Pattern Placement" 
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
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                {(() => {
                  // Use tool instance directly (single source of truth) to match cursor color
                  const padLayer = padToolLayer; // Always 'top' or 'bottom', never null
                  const padInstanceId = padLayer === 'top' ? 'padTop' : 'padBottom';
                  const padColor = toolInstanceManager.get(padInstanceId).color;
                  // Fixed icon size for toolbar (constant, regardless of actual pad size) - made larger
                  const iconSize = 14;
                  const iconX = (24 - iconSize) / 2;
                  const iconY = (24 - iconSize) / 2;
                  return <rect x={iconX} y={iconY} width={iconSize} height={iconSize} fill={padColor} />;
                })()}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>P</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{(() => {
                  // Use toolState.size when Pad tool is active (reactive to tool instance changes)
                  // Otherwise read directly from tool instance
                  if (currentTool === 'draw' && drawingMode === 'pad' && toolState.toolInstanceId && (toolState.toolInstanceId === 'padTop' || toolState.toolInstanceId === 'padBottom')) {
                    return toolState.size;
                  }
                  const instanceId = padToolLayer === 'top' ? 'padTop' : 'padBottom';
                  return toolInstanceManager.get(instanceId).size;
                })()}</span>
              </div>
            </button>
            <button 
              ref={testPointButtonRef}
              onClick={() => { 
                if (!isReadOnlyMode) { 
                  console.log('Test Point tool clicked');
                  clearAllSelections(); // Clear all selections when tool is selected
                  setDrawingMode('testPoint'); 
                  setCurrentTool('draw'); 
                  // The useEffect hook will automatically apply the default layer and show the layer chooser
                  // Force position recalculation on every click, even if dialog is already visible
                  setTimeout(() => updateTestPointChooserPosition(), 0);
                } 
              }} 
              disabled={isReadOnlyMode}
              title="Draw Test Points (Y)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'testPoint') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'testPoint' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                {(() => {
                  // Use tool instance directly (single source of truth) to match cursor color
                  const testPointLayer = testPointToolLayer; // Always 'top' or 'bottom', never null
                  const testPointInstanceId = testPointLayer === 'top' ? 'testPointTop' : 'testPointBottom';
                  const testPointColor = toolInstanceManager.get(testPointInstanceId).color;
                  // Draw diamond shape (bright yellow-filled with black border) - made larger
                  const size = 14;
                  const centerX = 12;
                  const centerY = 12;
                  return (
                    <path
                      d={`M ${centerX} ${centerY - size/2} L ${centerX + size/2} ${centerY} L ${centerX} ${centerY + size/2} L ${centerX - size/2} ${centerY} Z`}
                      fill={testPointColor}
                      stroke="#000"
                      strokeWidth="1.5"
                    />
                  );
                })()}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>Y</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{(() => {
                  // Use toolState.size when Test Point tool is active (reactive to tool instance changes)
                  // Otherwise read directly from tool instance
                  if (currentTool === 'draw' && drawingMode === 'testPoint' && toolState.toolInstanceId && (toolState.toolInstanceId === 'testPointTop' || toolState.toolInstanceId === 'testPointBottom')) {
                    return toolState.size;
                  }
                  const instanceId = testPointToolLayer === 'top' ? 'testPointTop' : 'testPointBottom';
                  return toolInstanceManager.get(instanceId).size;
                })()}</span>
              </div>
            </button>
            <button 
              ref={traceButtonRef}
              onMouseDown={(e) => {
                if (e.altKey && !isReadOnlyMode) {
                  // Option+click: open IC placement dialog
                  e.preventDefault();
                  e.stopPropagation();
                  setICPlacementIsPad(false);
                  setShowICPlacementDialog(true);
                  return;
                }
              }}
              onClick={(e) => { 
                if (!isReadOnlyMode && !e.altKey) {
                  console.log('Trace tool clicked');
                  clearAllSelections(); // Clear all selections when tool is selected
                  setDrawingMode('trace'); 
                  setCurrentTool('draw'); 
                  // Explicitly show layer chooser on every click (like pads and test points)
                  setShowTraceLayerChooser(true);
                  // The useEffect hook will automatically apply the default layer
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
                // Use tool instance directly (single source of truth) to match cursor color
                const layer = traceToolLayer; // Always 'top' or 'bottom', never null
                const traceInstanceId = layer === 'top' ? 'traceTop' : 'traceBottom';
                return toolInstanceManager.get(traceInstanceId).color;
              })()} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>T</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{(() => {
                  const instanceId = traceToolLayer === 'top' ? 'traceTop' : 'traceBottom';
                  return toolInstanceManager.get(instanceId).size;
                })()}</span>
              </div>
            </button>
            <button 
              ref={componentButtonRef}
              onClick={() => { 
                if (!isReadOnlyMode) {
                  console.log('Component tool clicked');
                  clearAllSelections(); // Clear all selections when tool is selected
                  setCurrentTool('component');
                  // The useEffect hook will show the component selection dialog
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
                // Use tool instance directly (single source of truth) to match cursor color
                const layer = componentToolLayer || 'top';
                const componentInstanceId = layer === 'top' ? 'componentTop' : 'componentBottom';
                const componentColor = toolInstanceManager.get(componentInstanceId).color;
                return selectedComponentType ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                    {/* Square icon with text - show specific designator prefix from metadata (e.g., CE, CF, Z, LED) */}
                    <rect x="4" y="4" width="16" height="16" fill="rgba(255,255,255,0.9)" stroke={componentColor} strokeWidth="1.5" />
                    <text x="12" y="14" textAnchor="middle" fontSize="7" fill={componentColor} fontWeight="bold" fontFamily="monospace">{
                      (() => {
                        // Prefer designator from componentDefinition (most specific)
                        const primaryDesignator =
                          selectedComponentMetadata?.componentDefinition?.designator ??
                          selectedComponentMetadata?.designator;

                        if (primaryDesignator) {
                          // Show up to 3 characters for multi-letter designators (CE, CF, LED, etc.)
                          return primaryDesignator.length <= 3
                            ? primaryDesignator
                            : primaryDesignator.substring(0, 3);
                        }
                        // Last resort: use default abbreviation
                        return getDefaultAbbreviation(selectedComponentType);
                      })()
                    }</text>
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
                  const instanceId = componentToolLayer === 'top' ? 'componentTop' : 'componentBottom';
                  return toolInstanceManager.get(instanceId).size;
                })()}</span>
              </div>
            </button>
            {/* Power tool */}
            <button 
              ref={powerButtonRef}
              onClick={() => { 
                if (!isReadOnlyMode) {
                  console.log('Power tool clicked');
                  clearAllSelections(); // Clear all selections when tool is selected
                  // Always close ground selector when power button is clicked
                  setShowGroundBusSelector(false);
                  if (powerBuses.length === 1) {
                    // Single bus: auto-select and switch to power tool
                    setSelectedPowerBusId(powerBuses[0].id);
                    setCurrentTool('power');
                    setShowPowerBusSelector(false);
                    setShowPowerLayer(true); // Automatically enable power layer visibility
                  } else if (powerBuses.length > 1) {
                    // Multiple buses: show selector but don't switch tool until selection
                    setShowPowerBusSelector(true);
                    // Keep current tool (don't switch to power yet)
                  } else {
                    // No buses: show selector
                    setShowPowerBusSelector(true);
                    setCurrentTool('power');
                    setShowPowerLayer(true); // Automatically enable power layer visibility
                  }
                }
              }} 
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
              {/* Power symbol icon - use selected power bus color to match cursor and drawn icon */}
              <span style={{ color: (selectedPowerBusId ? powerBuses.find(b => b.id === selectedPowerBusId)?.color : null) || '#ff0000', fontSize: '18px', fontWeight: 'bold', lineHeight: 1, flexShrink: 0 }}>V</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>B</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolInstanceManager.get('power').size}</span>
              </div>
            </button>
            {/* Ground tool */}
            <button 
              ref={groundButtonRef}
              onClick={() => { 
                if (!isReadOnlyMode) {
                  console.log('Ground tool clicked');
                  // Always close power selector when ground button is clicked
                  setShowPowerBusSelector(false);
                  if (groundBuses.length === 1) {
                    // Single bus: auto-select and switch to ground tool
                    setSelectedGroundBusId(groundBuses[0].id);
                    setCurrentTool('ground');
                    setShowGroundBusSelector(false);
                    setShowGroundLayer(true); // Automatically enable ground layer visibility
                  } else if (groundBuses.length > 1) {
                    // Multiple buses: show selector but don't switch tool until selection
                    setShowGroundBusSelector(true);
                    // Keep current tool (don't switch to ground yet)
                  } else {
                    // No buses: show selector
                    setShowGroundBusSelector(true);
                    setCurrentTool('ground');
                    setShowGroundLayer(true); // Automatically enable ground layer visibility
                  }
                }
              }} 
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
              {/* Ground symbol icon - use selected ground bus color to match cursor and drawn icon */}
              <svg width="14" height="14" viewBox="0 0 24 20" aria-hidden="true" style={{ overflow: 'visible', flexShrink: 0 }}>
                <g stroke={(selectedGroundBusId ? groundBuses.find(b => b.id === selectedGroundBusId)?.color : null) || '#000000'} strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="2" x2="12" y2="10" />
                  <line x1="5" y1="10" x2="19" y2="10" />
                  <line x1="7" y1="13" x2="17" y2="13" />
                  <line x1="9.5" y1="16" x2="14.5" y2="16" />
                </g>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>G</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolInstanceManager.get('ground').size}</span>
              </div>
            </button>
            {/* Empty space separator after Ground tool (height = 1 toolbar tool height) */}
            <div style={{ height: 32 }} />
            {/* Move tool (H) - moved above Set Home */}
              <button 
                onClick={() => { 
                  if (!isReadOnlyMode) {
                    clearAllSelections(); // Clear all selections when tool is selected
                    setCurrentTool(prev => prev === 'pan' ? 'draw' : 'pan');
                  }
                }} 
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
            {/* Magnify tool (M) - moved above Set Home */}
            <button 
              onClick={() => { 
                clearAllSelections(); // Clear all selections when tool is selected
                setIsShiftPressed(false); 
                setCurrentTool(prev => prev === 'magnify' ? 'draw' : 'magnify');
              }} 
              title={`Magnify (M)`} 
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
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>M</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>-</span>
              </div>
            </button>
            {/* Change Perspective tool (E) - opens Tools -> Change Perspective dialog */}
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) {
                  setTransformAllDialogVisible(true);
                }
              }} 
              disabled={isReadOnlyMode}
              title="Change Perspective (E) - Open Change Perspective Dialog" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: transformAllDialogVisible ? '2px solid #000' : '1px solid #ddd', 
                background: transformAllDialogVisible ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Eye icon - simple line art style */}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                {/* Eye outline (almond shape) */}
                <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="#111" strokeWidth="2" />
                {/* Iris circle */}
                <circle cx="12" cy="12" r="4" fill="none" stroke="#111" strokeWidth="2" />
                {/* Pupil (offset slightly up-left) */}
                <circle cx="11" cy="11" r="1.5" fill="#111" stroke="none" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>E</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>-</span>
              </div>
            </button>
            {/* Set Home tool (X) - click then press 0-9 to save current view */}
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) {
                  clearAllSelections(); // Clear all selections when tool is selected
                  setCurrentTool('center');
                  // Start waiting for number key with 2-second timeout
                  setIsWaitingForHomeViewKey(true);
                  if (homeViewTimeoutRef.current) {
                    clearTimeout(homeViewTimeoutRef.current);
                  }
                  homeViewTimeoutRef.current = setTimeout(() => {
                    setIsWaitingForHomeViewKey(false);
                    setCurrentTool('select');
                    setCanvasCursor(undefined);
                  }, 2000);
                }
              }} 
              disabled={isReadOnlyMode}
              title="Set View (X) - Press 0-9 to Set View" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: currentTool === 'center' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'center' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Bold X crosshairs icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <line x1="12" y1="2" x2="12" y2="10" stroke="#111" strokeWidth="3" strokeLinecap="round" />
                <line x1="12" y1="14" x2="12" y2="22" stroke="#111" strokeWidth="3" strokeLinecap="round" />
                <line x1="2" y1="12" x2="10" y2="12" stroke="#111" strokeWidth="3" strokeLinecap="round" />
                <line x1="14" y1="12" x2="22" y2="12" stroke="#111" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>X</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>-</span>
              </div>
            </button>
            {/* Erase tool - HIDDEN (code kept for potential future use)
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) {
                  clearAllSelections(); // Clear all selections when tool is selected
                  setCurrentTool('erase');
                }
              }} 
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
            */}
            {/* Color picker */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { if (!isReadOnlyMode) setShowColorPicker(prev => !prev); }} 
                disabled={isReadOnlyMode}
                title="Color Picker" 
                style={{ 
                  width: '100%', 
                  height: 32, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 6, 
                  border: '1px solid #ddd', 
                  background: '#fff',
                  cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                  opacity: isReadOnlyMode ? 0.5 : 1
                }}
              >
                {/* Color palette grid icon - 4x4 grid representing the color picker */}
                <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
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
                        
                        // Update tool instance color (equivalent to Tools -> Set Tool Color)
                        try {
                          let toolInstanceId: ToolInstanceId | null = null;
                          
                          // Determine tool instance ID based on current tool and layer
                          if (currentTool === 'draw' && drawingMode === 'via') {
                            toolInstanceId = 'via';
                          } else if (currentTool === 'draw' && drawingMode === 'pad') {
                            const layer = padToolLayer || 'top';
                            toolInstanceId = layer === 'bottom' ? 'padBottom' : 'padTop';
                          } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
                            const layer = testPointToolLayer || 'top';
                            toolInstanceId = layer === 'bottom' ? 'testPointBottom' : 'testPointTop';
                          } else if (currentTool === 'draw' && drawingMode === 'trace') {
                            const layer = traceToolLayer || 'top';
                            toolInstanceId = layer === 'bottom' ? 'traceBottom' : 'traceTop';
                          } else if (currentTool === 'component') {
                            const layer = componentToolLayer || 'top';
                            toolInstanceId = layer === 'bottom' ? 'componentBottom' : 'componentTop';
                          } else if (currentTool === 'power') {
                            toolInstanceId = 'power';
                          } else if (currentTool === 'ground') {
                            toolInstanceId = 'ground';
                          }
                          
                          // Update tool instance color if we have a valid tool instance
                          if (toolInstanceId) {
                            toolInstanceManager.setColor(toolInstanceId, c);
                          }
                        } catch (error) {
                          console.error('Error updating tool instance color:', error);
                        }
                        
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
                          } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
                            const layer = testPointToolLayer || 'top';
                            const layerSettings = currentToolDef.layerSettings.get(layer);
                            const currentSize = layerSettings?.size || currentToolDef.settings.size;
                            const newLayerSettings = { color: c, size: currentSize };
                            updateToolLayerSettings(currentToolDef.id, layer, newLayerSettings);
                            saveToolLayerSettings(currentToolDef.id, layer, c, currentSize);
                            if (layer === 'top') {
                              setTopTestPointColor(c);
                              saveDefaultColor('testPoint', c, 'top');
                            } else {
                              setBottomTestPointColor(c);
                              saveDefaultColor('testPoint', c, 'bottom');
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
                        // Also save to layer defaults
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
            {/* Empty space separator after Color Picker (height = 1 toolbar tool height) */}
            <div style={{ height: 32 }} />
            {/* Information Icon Button */}
            <button 
              onClick={() => { if (!isReadOnlyMode) handleOpenInformation(); }} 
              disabled={isReadOnlyMode}
              title="Information (I)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 6px',
                borderRadius: 6, 
                border: '1px solid #ddd', 
                background: '#fff',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1,
              }}
            >
              {/* Info icon - blue circle with white 'i' */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" fill="#4A90E2" />
                <rect x="10.5" y="6" width="3" height="3" rx="1.5" fill="white" />
                <rect x="10.5" y="11" width="3" height="7" rx="1.5" fill="white" />
              </svg>
            </button>
            {/* Project Notes Icon Button */}
            <button 
              onClick={() => { if (!isReadOnlyMode) handleOpenProjectNotes(); }} 
              disabled={isReadOnlyMode}
              title="Project Notes (L)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                borderRadius: 6, 
                border: '1px solid #ddd', 
                background: '#fff',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1,
              }}
            >
              {/* List icon - white background with yellow border, 3 rows of black circles and rectangles */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#fff" stroke="#FFD700" strokeWidth="1.5" />
                {/* Row 1 */}
                <circle cx="6" cy="7" r="1.5" fill="#000" />
                <rect x="9" y="6" width="10" height="2" rx="1" fill="#000" />
                {/* Row 2 */}
                <circle cx="6" cy="12" r="1.5" fill="#000" />
                <rect x="9" y="11" width="10" height="2" rx="1" fill="#000" />
                {/* Row 3 */}
                <circle cx="6" cy="17" r="1.5" fill="#000" />
                <rect x="9" y="16" width="10" height="2" rx="1" fill="#000" />
              </svg>
            </button>
            {/* Test Points Icon Button */}
            <button 
              onClick={() => { if (!isReadOnlyMode) handleOpenTestPoints(); }} 
              disabled={isReadOnlyMode}
              title="Test Points" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                borderRadius: 6, 
                border: '1px solid #ddd', 
                background: '#fff',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1,
              }}
            >
              {/* Checklist icon - bright yellow background, 3 rows of black circles and rectangles */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <rect width="24" height="24" rx="2" fill="#FFD700" />
                {/* Row 1 */}
                <circle cx="6" cy="7" r="1.5" fill="#000" />
                <rect x="9" y="6" width="12" height="2" rx="1" fill="#000" />
                {/* Row 2 */}
                <circle cx="6" cy="12" r="1.5" fill="#000" />
                <rect x="9" y="11" width="12" height="2" rx="1" fill="#000" />
                {/* Row 3 */}
                <circle cx="6" cy="17" r="1.5" fill="#000" />
                <rect x="9" y="16" width="12" height="2" rx="1" fill="#000" />
              </svg>
            </button>
          </div>
          {/* Active tool layer chooser for Trace */}
          {(currentTool === 'draw' && drawingMode === 'trace' && showTraceLayerChooser) && (
            <div ref={traceChooserRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
              <label className="radio-label" style={{ marginRight: 6 }}>
                <input type="radio" name="traceToolLayer" checked={traceToolLayer === 'top'} onChange={() => { 
                  console.log('Trace tool Top clicked');
                  // Update ref immediately (synchronously) so size/color updates use correct layer
                  traceToolLayerRef.current = 'top';
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
                  setShowTopTracesLayer(true); // Automatically enable top traces layer visibility 
                }} />
                <span>Top</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="traceToolLayer" checked={traceToolLayer === 'bottom'} onChange={() => { 
                  console.log('Trace tool Bottom clicked');
                  // Update ref immediately (synchronously) so size/color updates use correct layer
                  traceToolLayerRef.current = 'bottom';
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
                  setShowBottomTracesLayer(true); // Automatically enable bottom traces layer visibility 
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
                  console.log('Pad tool Top clicked');
                  // Update ref immediately (synchronously) so size/color updates use correct layer
                  padToolLayerRef.current = 'top';
                  setPadToolLayer('top'); 
                  setSelectedDrawingLayer('top'); 
                  // Use tool instance directly (single source of truth)
                  const padTopInstance = toolInstanceManager.get('padTop');
                  setBrushColor(padTopInstance.color);
                  setBrushSize(padTopInstance.size);
                  // Update toolRegistry to reflect current layer's color
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const padDef = updated.get('pad');
                    if (padDef) {
                      updated.set('pad', { ...padDef, settings: { color: padTopInstance.color, size: padTopInstance.size } });
                    }
                    return updated;
                  });
                  setShowPadLayerChooser(false); 
                  setShowTopImage(true);
                  setShowTopPadsLayer(true); // Automatically enable top pads layer visibility 
                }} />
                <span>Top</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="padToolLayer" checked={padToolLayer === 'bottom'} onChange={() => { 
                  console.log('Pad tool Bottom clicked');
                  // Update ref immediately (synchronously) so size/color updates use correct layer
                  padToolLayerRef.current = 'bottom';
                  setPadToolLayer('bottom'); 
                  setSelectedDrawingLayer('bottom'); 
                  // Use tool instance directly (single source of truth)
                  const padBottomInstance = toolInstanceManager.get('padBottom');
                  setBrushColor(padBottomInstance.color);
                  setBrushSize(padBottomInstance.size);
                  // Update toolRegistry to reflect current layer's color
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const padDef = updated.get('pad');
                    if (padDef) {
                      updated.set('pad', { ...padDef, settings: { color: padBottomInstance.color, size: padBottomInstance.size } });
                    }
                    return updated;
                  });
                  setShowPadLayerChooser(false); 
                  setShowBottomImage(true);
                  setShowBottomPadsLayer(true); // Automatically enable bottom pads layer visibility 
                }} />
                <span>Bottom</span>
              </label>
            </div>
          )}
          {/* Active tool layer chooser for Test Point */}
          {(currentTool === 'draw' && drawingMode === 'testPoint' && showTestPointLayerChooser) && (
            <div ref={testPointChooserRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
              <label className="radio-label" style={{ marginRight: 6 }}>
                <input type="radio" name="testPointToolLayer" checked={testPointToolLayer === 'top'} onChange={() => { 
                  console.log('Test Point tool Top clicked');
                  // Update ref immediately (synchronously) so size/color updates use correct layer
                  testPointToolLayerRef.current = 'top';
                  setTestPointToolLayer('top'); 
                  setSelectedDrawingLayer('top'); 
                  // Use layer-specific test point colors and sizes
                  setBrushColor(topTestPointColor);
                  setBrushSize(topTestPointSize);
                  // Update toolRegistry to reflect current layer's color
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const testPointDef = updated.get('testPoint');
                    if (testPointDef) {
                      updated.set('testPoint', { ...testPointDef, settings: { color: topTestPointColor, size: topTestPointSize } });
                    }
                    return updated;
                  });
                  setShowTestPointLayerChooser(false); 
                  setShowTopImage(true);
                  setShowTopTestPointsLayer(true); // Automatically enable top test points layer visibility 
                }} />
                <span>Top</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="testPointToolLayer" checked={testPointToolLayer === 'bottom'} onChange={() => { 
                  console.log('Test Point tool Bottom clicked');
                  // Update ref immediately (synchronously) so size/color updates use correct layer
                  testPointToolLayerRef.current = 'bottom';
                  setTestPointToolLayer('bottom'); 
                  setSelectedDrawingLayer('bottom'); 
                  // Use layer-specific test point colors and sizes
                  setBrushColor(bottomTestPointColor);
                  setBrushSize(bottomTestPointSize);
                  // Update toolRegistry to reflect current layer's color
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const testPointDef = updated.get('testPoint');
                    if (testPointDef) {
                      updated.set('testPoint', { ...testPointDef, settings: { color: bottomTestPointColor, size: bottomTestPointSize } });
                    }
                    return updated;
                  });
                  setShowTestPointLayerChooser(false); 
                  setShowBottomImage(true);
                  setShowBottomTestPointsLayer(true); // Automatically enable bottom test points layer visibility 
                }} />
                <span>Bottom</span>
              </label>
            </div>
          )}
          {/* Power Bus Selector */}
          {showPowerBusSelector && (
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
                      // Set the selected power bus first, then switch to power tool, and close the selector
                      // Use functional update to ensure state is set correctly
                      setSelectedPowerBusId(bus.id);
                      // Only set tool if not already power (to avoid triggering unnecessary useEffect)
                      if (currentTool !== 'power') {
                        clearAllSelections(); // Clear all selections when tool is selected
                        setCurrentTool('power');
                        setShowPowerLayer(true); // Automatically enable power layer visibility
                      }
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
          {showGroundBusSelector && (
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
                        // Set the selected ground bus first, then switch to ground tool, and close the selector
                        // Use functional update to ensure state is set correctly
                        setSelectedGroundBusId(bus.id);
                        // Only set tool if not already ground (to avoid triggering unnecessary useEffect)
                        if (currentTool !== 'ground') {
                          clearAllSelections(); // Clear all selections when tool is selected
                          setCurrentTool('ground');
                          setShowGroundLayer(true); // Automatically enable ground layer visibility
                        }
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

          {/* Layers miniatures (Pages-like) with visibility toggles and transparency */}
          <div style={{ position: 'absolute', top: 6, left: 60, bottom: 6, width: 168, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 15 }}>
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
            <div style={{ height: 1, background: '#000', margin: '4px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showViasLayer} onChange={(e) => setShowViasLayer(e.target.checked)} />
              <span>Vias</span>
            </label>
            <div style={{ height: 1, background: '#000', margin: '4px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopTracesLayer} onChange={(e) => setShowTopTracesLayer(e.target.checked)} />
              <span>Traces (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopComponents} onChange={(e) => setShowTopComponents(e.target.checked)} />
              <span>Components (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopPadsLayer} onChange={(e) => setShowTopPadsLayer(e.target.checked)} />
              <span>Pads (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopTestPointsLayer} onChange={(e) => setShowTopTestPointsLayer(e.target.checked)} />
              <span>Test Points (Top)</span>
            </label>
            <div style={{ height: 1, background: '#000', margin: '4px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomTracesLayer} onChange={(e) => setShowBottomTracesLayer(e.target.checked)} />
              <span>Traces (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomComponents} onChange={(e) => setShowBottomComponents(e.target.checked)} />
              <span>Components (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomPadsLayer} onChange={(e) => setShowBottomPadsLayer(e.target.checked)} />
              <span>Pads (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomTestPointsLayer} onChange={(e) => setShowBottomTestPointsLayer(e.target.checked)} />
              <span>Test Points (Bottom)</span>
            </label>
            <div style={{ height: 1, background: '#000', margin: '4px 0' }} />
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
            <div style={{ height: 1, background: '#000', margin: '4px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="checkbox" 
                checked={showViasLayer && showTopPadsLayer && showBottomPadsLayer && showTopTestPointsLayer && showBottomTestPointsLayer && showTopTracesLayer && showBottomTracesLayer && showTopComponents && showBottomComponents && showPowerLayer && showGroundLayer && showConnectionsLayer}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setShowViasLayer(newValue);
                  setShowTopPadsLayer(newValue);
                  setShowBottomPadsLayer(newValue);
                  setShowTopTestPointsLayer(newValue);
                  setShowBottomTestPointsLayer(newValue);
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
            <div style={{ height: 1, background: '#000', margin: '4px 0' }} />
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
              {/* Cycle Speed slider - only visible when Cycle is enabled */}
              {/* Slider is reversed: left = fast (500ms), right = slow (8000ms) */}
              {/* We invert by using (8500 - value) so moving right increases speed */}
              {isTransparencyCycling && (
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 10, color: '#333' }}>
                    Cycle Speed: {(transparencyCycleSpeed / 1000).toFixed(1)}s
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="8000"
                    step="100"
                    value={8500 - transparencyCycleSpeed}
                    onChange={(e) => setTransparencyCycleSpeed(8500 - Number(e.target.value))}
                    onDoubleClick={() => setTransparencyCycleSpeed(2000)}
                className="slider"
                style={{ width: '100%', marginTop: 3 }}
              />
                </div>
              )}
            </div>
          </div>

          {/* Canvas welcome note - shown when no project is loaded */}
          <WelcomeDialog 
            visible={!topImage && !bottomImage && !hasDismissedSplash} 
            canvasSize={canvasSize}
            canvasPosition={{ left: 244, top: 6 }}
          />

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
              position: 'absolute',
              left: '244px', // Start after Layers panel (60 + 168 + 6 gap + 10px)
              top: '6px',
              ...(canvasCursor ? { cursor: canvasCursor } : (currentTool === 'pan' ? { cursor: isPanning ? 'grabbing' : 'grab' } : {})),
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              maxHeight: 'none',
              aspectRatio: 'auto',
              border: 'none'
            }}
          />
          
          {/* Memory monitor display (to the left of coordinates) */}
          {showMemoryMonitor && ENABLE_MEMORY_MONITOR && memoryInfo && (
            <div
              style={{
                position: 'absolute',
                left: `${244 + 10}px`, // Left side of canvas area + 10px margin
                top: `${6 + canvasSize.height + 4}px`, // Below canvas border (same as coordinates)
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#333',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #ccc',
                pointerEvents: 'none',
                zIndex: 1000,
                whiteSpace: 'nowrap',
              }}
            >
              Mem: {memoryInfo.usedJSHeapSize > 0 
                ? `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / ${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(0)}MB`
                : 'N/A (Chrome/Edge only)'}
            </div>
          )}
          
          {/* NextNodeId debug display (center) */}
          <div
            style={{
              position: 'absolute',
              left: `${244 + canvasSize.width / 2 - 50}px`, // Center of canvas
              top: `${6 + canvasSize.height + 4}px`, // Below canvas border
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#333',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 6px',
              borderRadius: '3px',
              border: '1px solid #ccc',
              pointerEvents: 'none',
              zIndex: 1000,
              whiteSpace: 'nowrap',
            }}
          >
            NextNodeId: {getPointIdCounter()}
          </div>
          
          {/* Mouse world coordinates display */}
          {mouseWorldPos && (
            <div
              style={{
                position: 'absolute',
                left: `${244 + canvasSize.width - 120}px`, // Right edge of canvas minus width of display
                top: `${6 + canvasSize.height + 4}px`, // Below canvas border (6px top + canvas height + 4px gap)
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#333',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #ccc',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            >
              ({mouseWorldPos.x.toFixed(1)}mm, {mouseWorldPos.y.toFixed(1)}mm)
            </div>
          )}
          
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
            projectDirHandle={projectDirHandle}
            showAiSettingsDialog={showAiSettingsDialog}
            onAiSettingsDialogClose={() => setShowAiSettingsDialog(false)}
            onFindComponent={findAndCenterComponent}
            componentDefinition={componentEditor ? (() => {
              // Find the component being edited to resolve its definition
              const comp = componentsTop.find(c => c.id === componentEditor.id) || 
                          componentsBottom.find(c => c.id === componentEditor.id);
              if (!comp) return undefined;
              
              // First, try to use the definition from componentEditor state (most reliable)
              if ((componentEditor as any).componentDefinition) {
                return (componentEditor as any).componentDefinition;
              }
              
              // Fallback: Try to resolve from component
              const resolved = resolveComponentDefinition(comp as any);
              
              // If we successfully resolved it but component doesn't have the key, set it
              if (resolved && !(comp as any).componentDefinitionKey) {
                const defKey = `${resolved.category}:${resolved.subcategory}`;
                (comp as any).componentDefinitionKey = defKey;
                // Update the component in state with the key
                if (componentEditor.layer === 'top') {
                  setComponentsTop(prev => prev.map(c => c.id === comp.id ? { ...c, componentDefinitionKey: defKey } as any : c));
                } else {
                  setComponentsBottom(prev => prev.map(c => c.id === comp.id ? { ...c, componentDefinitionKey: defKey } as any : c));
                }
              }
              
              return resolved;
            })() : undefined}
            canvasHeight={canvasSize.height}
          />

          {/* Component Hover Tooltip (only shown when Option key is held) */}
          {hoverComponent && isOptionPressed && (() => {
            const comp = hoverComponent.component;
            const layer = hoverComponent.layer;
            if (!comp) return null;
            
            // Use cached tooltip content if available for this component
            if (tooltipCacheRef.current && tooltipCacheRef.current.componentId === comp.id) {
              return tooltipCacheRef.current.content;
            }
            
            // Generate tooltip content (expensive operation for components with many pins)
            // Always show component type (required field)
            const componentType = comp.componentType || 'Component';
            // Get IC type for IntegratedCircuit components
            const icType = comp.componentType === 'IntegratedCircuit' && 'icType' in comp ? comp.icType : null;
            // Get detailed component information
            const componentDetails = getComponentDetails(comp);
            // Check if this is a semiconductor for pin table display
            const compDef = resolveComponentDefinition(comp as any);
            const isSemiconductor = compDef?.category === 'Semiconductors';
            // Get pin names and connections for semiconductors
            const instancePinNames = (comp as any)?.pinNames as string[] | undefined;
            const definitionPinNames = compDef?.properties?.pinNames as string[] | undefined;
            
            // Calculate tooltip position near mouse pointer with smart positioning
            // Offset from mouse cursor (smaller offset for closer positioning)
            const offsetX = 8;
            const offsetY = 8;
            // Estimated tooltip dimensions (will be adjusted by browser)
            const tooltipWidth = 200; // Approximate width
            const tooltipHeight = 150; // Approximate height
            const margin = 10; // Margin from screen edges
            
            // Start with mouse position + offset
            let tooltipX = hoverComponent.x + offsetX;
            let tooltipY = hoverComponent.y + offsetY;
            
            // Adjust if tooltip would go off right edge
            if (tooltipX + tooltipWidth + margin > window.innerWidth) {
              tooltipX = hoverComponent.x - tooltipWidth - offsetX;
            }
            
            // Adjust if tooltip would go off bottom edge
            if (tooltipY + tooltipHeight + margin > window.innerHeight) {
              tooltipY = hoverComponent.y - tooltipHeight - offsetY;
            }
            
            // Ensure tooltip stays within screen bounds
            tooltipX = Math.max(margin, Math.min(tooltipX, window.innerWidth - tooltipWidth - margin));
            tooltipY = Math.max(margin, Math.min(tooltipY, window.innerHeight - tooltipHeight - margin));
            
            // Build the tooltip JSX
            const tooltipContent = (
              <div
                style={{
                  position: 'fixed',
                  left: `${tooltipX}px`,
                  top: `${tooltipY}px`,
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
                  {formatComponentTypeName(componentType)}
                </div>
                <div style={{ marginBottom: '4px', color: '#e0e0e0', fontSize: '11px' }}>
                  Layer: {layer === 'top' ? 'Top' : 'Bottom'}
                </div>
                {icType && (
                  <div style={{ marginBottom: '4px', color: '#e0e0e0', fontSize: '11px' }}>
                    IC Type: {icType}
                  </div>
                )}
                {componentDetails.length > 0 && (
                  <div style={{ marginBottom: '4px' }}>
                    {componentDetails.map((detail, index) => (
                      <div key={index} style={{ color: '#e0e0e0', fontSize: '11px', marginBottom: '2px' }}>
                        {detail}
                      </div>
                    ))}
                  </div>
                )}
                {comp.description && (
                  <div style={{ marginBottom: '4px', color: '#e0e0e0', fontSize: '11px' }}>
                    {comp.description}
                  </div>
                )}
                {comp.notes && (
                  <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '11px', color: '#d0d0d0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {comp.notes}
                  </div>
                )}
                {isSemiconductor && comp.pinCount > 0 && (() => {
                  // Build pin table for semiconductors
                  const pinRows = Array.from({ length: comp.pinCount }, (_, i) => {
                    const pinConnection = comp.pinConnections && comp.pinConnections.length > i ? comp.pinConnections[i] : '';
                    // Get pin name from instance or definition
                    const instancePinName = instancePinNames && i < instancePinNames.length ? instancePinNames[i] : '';
                    const defaultPinName = definitionPinNames && i < definitionPinNames.length ? definitionPinNames[i] : '';
                    const isChipDependent = defaultPinName === 'CHIP_DEPENDENT';
                    // Use instance value if it exists and is not empty, otherwise use default (unless it's CHIP_DEPENDENT)
                    const pinName = (instancePinName && instancePinName.trim() !== '') ? instancePinName : 
                                  (isChipDependent ? '' : defaultPinName);
                    return { pin: i + 1, name: pinName || '-', nodeId: pinConnection || '-' };
                  });
                  
                  return (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#fff' }}>
                        Pin Connections:
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
                            <th style={{ textAlign: 'left', padding: '2px 6px', fontWeight: 600, color: '#fff' }}>Pin</th>
                            <th style={{ textAlign: 'left', padding: '2px 6px', fontWeight: 600, color: '#fff' }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '2px 6px', fontWeight: 600, color: '#fff' }}>Node ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pinRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              <td style={{ padding: '2px 6px', color: '#e0e0e0', fontFamily: 'monospace' }}>{row.pin}</td>
                              <td style={{ padding: '2px 6px', color: '#e0e0e0', fontStyle: row.name !== '-' ? 'italic' : 'normal' }}>{row.name}</td>
                              <td style={{ padding: '2px 6px', color: '#e0e0e0', fontFamily: 'monospace' }}>{row.nodeId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            );
            
            // Cache the tooltip content to avoid expensive re-renders
            tooltipCacheRef.current = {
              componentId: comp.id,
              content: tooltipContent
            };
            
            return tooltipContent;
          })()}

          {/* Test Point Hover Tooltip (only shown when Option key is held) */}
          {hoverTestPoint && isOptionPressed && (() => {
            const stroke = hoverTestPoint.stroke;
            // Only show popup if test point has notes
            if (!stroke.notes) return null;
            return (
              <div
                style={{
                  position: 'fixed',
                  left: `${hoverTestPoint.x + 10}px`,
                  top: `${hoverTestPoint.y + 10}px`,
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
                  Test Point
                </div>
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '11px', color: '#d0d0d0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {stroke.notes}
                </div>
              </div>
            );
          })()}

          {/* Connection Hover Tooltip (only shown when Option key is held over semiconductor connections) */}
          {hoverConnection && isOptionPressed && (() => {
            const comp = hoverConnection.component;
            const pinIndices = hoverConnection.pinIndices;
            
            // Get pin data from component
            const pinData = (comp as any).pinData as Array<{ name: string; type?: string; alternate_functions?: string[] }> | undefined;
            const pinNames = (comp as any).pinNames as string[] | undefined; // Fallback for legacy data
            
            // Get component definition pin names as default
            const compDef = resolveComponentDefinition(comp as any);
            const definitionPinNames = compDef?.properties?.pinNames as string[] | undefined;
            
            // Build pin info for each connected pin
            const pinInfoList = pinIndices.map(pinIndex => {
              // Get pin name from pinData (preferred), pinNames (legacy), or definition
              let pinName = `Pin ${pinIndex + 1}`;
              if (pinData && pinIndex < pinData.length && pinData[pinIndex]?.name?.trim()) {
                pinName = pinData[pinIndex].name.trim();
              } else if (pinNames && pinIndex < pinNames.length && pinNames[pinIndex]?.trim()) {
                pinName = pinNames[pinIndex].trim();
              } else if (definitionPinNames && pinIndex < definitionPinNames.length) {
                const defName = definitionPinNames[pinIndex];
                if (defName && defName !== 'CHIP_DEPENDENT') {
                  pinName = defName;
                }
              }
              
              // Get pin type from pinData
              const pinType = pinData && pinIndex < pinData.length ? pinData[pinIndex]?.type?.trim() : undefined;
              
              return {
                pinNumber: pinIndex + 1,
                pinName,
                pinType: pinType || undefined
              };
            });
            
            // Calculate tooltip position
            const offsetX = 10;
            const offsetY = 10;
            let tooltipX = hoverConnection.x + offsetX;
            let tooltipY = hoverConnection.y + offsetY;
            
            // Ensure tooltip stays within screen bounds
            const tooltipWidth = 180;
            const tooltipHeight = 80 + pinInfoList.length * 20;
            const margin = 10;
            
            if (tooltipX + tooltipWidth + margin > window.innerWidth) {
              tooltipX = hoverConnection.x - tooltipWidth - offsetX;
            }
            if (tooltipY + tooltipHeight + margin > window.innerHeight) {
              tooltipY = hoverConnection.y - tooltipHeight - offsetY;
            }
            tooltipX = Math.max(margin, tooltipX);
            tooltipY = Math.max(margin, tooltipY);
            
            return (
              <div
                style={{
                  position: 'fixed',
                  left: `${tooltipX}px`,
                  top: `${tooltipY}px`,
                  background: 'rgba(0, 0, 0, 0.90)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 4,
                  fontSize: '12px',
                  lineHeight: '1.4',
                  zIndex: 10000,
                  pointerEvents: 'none',
                  width: 'max-content',
                  maxWidth: '300px',
                  minWidth: '120px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(100, 180, 255, 0.5)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '6px', color: '#90caf9' }}>
                  {comp.designator} Connection
                </div>
                <div style={{ fontSize: '11px', marginBottom: '4px', color: '#bbb' }}>
                  Node ID: <span style={{ fontFamily: 'monospace', color: '#fff' }}>{hoverConnection.nodeId}</span>
                </div>
                {pinInfoList.map((info, idx) => (
                  <div key={idx} style={{ 
                    marginTop: idx > 0 ? '6px' : '0',
                    paddingTop: idx > 0 ? '6px' : '0',
                    borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none'
                  }}>
                    <div style={{ fontSize: '11px', color: '#e0e0e0' }}>
                      <span style={{ fontWeight: 500 }}>Pin {info.pinNumber}:</span>{' '}
                      <span style={{ fontStyle: 'italic', color: '#fff' }}>{info.pinName}</span>
                    </div>
                    {info.pinType && (
                      <div style={{ fontSize: '10px', marginTop: '2px', color: '#90caf9' }}>
                        Type: {info.pinType}
                      </div>
                    )}
                  </div>
                ))}
                {hoverConnection.stroke?.notes && hoverConnection.stroke.notes.trim() && (
                  <div style={{ 
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 500, color: '#90caf9', marginBottom: '4px' }}>
                      Notes:
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#e0e0e0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxWidth: '280px'
                    }}>
                      {hoverConnection.stroke.notes}
                    </div>
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

        </div>
      </div>

      {/* Power Bus Manager Dialog */}
      <PowerBusManagerDialog
        visible={showPowerBusManager}
        onClose={() => setShowPowerBusManager(false)}
        powerBuses={powerBuses}
        setPowerBuses={setPowerBuses}
        editingPowerBusId={editingPowerBusId}
        setEditingPowerBusId={setEditingPowerBusId}
        powers={powers}
      />

      {/* Ground Bus Manager Dialog */}
      <GroundBusManagerDialog
        visible={showGroundBusManager}
        onClose={() => setShowGroundBusManager(false)}
        groundBuses={groundBuses}
        setGroundBuses={setGroundBuses}
        editingGroundBusId={editingGroundBusId}
        setEditingGroundBusId={setEditingGroundBusId}
        grounds={grounds}
      />
      <PastMachineDialog
        visible={showPastMachine}
        projectDirHandle={projectDirHandle}
        onClose={() => {
          setShowPastMachine(false);
          setPastMachinePosition(undefined);
        }}
        onRestore={restoreFileFromHistory}
        position={pastMachinePosition}
        isDragging={isDraggingPastMachine}
        onDragStart={handlePastMachineDragStart}
      />

      {/* Designator Manager Dialog */}
      <DesignatorManagerDialog
        visible={showDesignatorManager}
        onClose={() => setShowDesignatorManager(false)}
        autoAssignDesignators={autoAssignDesignators}
        setAutoAssignDesignators={setAutoAssignDesignators}
        useGlobalDesignatorCounters={useGlobalDesignatorCounters}
        setUseGlobalDesignatorCounters={setUseGlobalDesignatorCounters}
      />

      {/* Hidden file inputs for Load Top/Bottom PCB menu items */}
      <input
        ref={fileInputTopRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
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
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
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
              // CRITICAL: Close current project first to release all browser permissions and clear all state
              // This prevents state leakage from the previous project into the newly opened project
              closeProject();
              
              // Small delay to ensure state is cleared before proceeding
              await new Promise(resolve => setTimeout(resolve, 0));
              
              // Update current project file path
              setCurrentProjectFilePath(file.name);
              const text = await file.text();
              const project = JSON.parse(text);
              
              // Get directory handle if possible (for auto-save)
              let projectDirHandle: FileSystemDirectoryHandle | null = null;
              // Note: With fallback file input, we can't get directory handle directly
              // User will need to set up auto-save directory separately if needed
              
              await loadProject(project, projectDirHandle);
              
              // Extract project name from project data or filename (no localStorage)
              let projectNameToUse: string;
              if (project.projectInfo?.name) {
                projectNameToUse = project.projectInfo.name;
              } else {
                // Extract from filename (remove .json extension)
                const projectNameFromFile = file.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                projectNameToUse = projectNameFromFile;
                if (!projectNameToUse) {
                  console.error('Failed to extract project name from filename');
                  alert('Warning: Could not determine project name from filename. Please ensure the project file has a valid name.');
                  return;
                }
                setProjectName(projectNameToUse);
              }
              
              // Ensure project name is set (loadProject may have set it, but verify)
              if (!projectName) {
                setProjectName(projectNameToUse);
              }
              
              // Enable auto-save by default with 5 minute interval
              // Use setTimeout to allow React state updates from loadProject to complete
              setTimeout(async () => {
                await handleAutoSaveApply(5, true);
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
        determineTestPointType={determineTestPointType}
        onFindComponent={findAndCenterComponent}
        onFindStroke={findAndCenterStroke}
        onFindPower={findAndCenterPower}
        onFindGround={findAndCenterGround}
        onOpenNotesDialog={() => setNotesDialogVisible(true)}
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
        canvasHeight={canvasSize.height}
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
        determineTestPointType={determineTestPointType}
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

      {/* Project Notes Dialog */}
      <ProjectNotesDialog
        visible={projectNotesDialogVisible}
        projectNotes={projectNotes}
        setProjectNotes={setProjectNotes}
        projectMetadata={projectMetadata}
        setProjectMetadata={setProjectMetadata}
        onClose={() => {
          setProjectNotesDialogVisible(false);
          // Don't reset position - keep it for next time
        }}
        position={projectNotesDialogPosition}
        isDragging={isDraggingProjectNotesDialog}
        onDragStart={(e) => {
          if (projectNotesDialogPosition) {
            setProjectNotesDialogDragOffset({
              x: e.clientX - projectNotesDialogPosition.x,
              y: e.clientY - projectNotesDialogPosition.y,
            });
            setIsDraggingProjectNotesDialog(true);
            e.preventDefault();
          } else {
            // Initialize position on first drag
            setProjectNotesDialogPosition({ x: e.clientX - 300, y: e.clientY - 200 });
            setProjectNotesDialogDragOffset({ x: 300, y: 200 });
            setIsDraggingProjectNotesDialog(true);
            e.preventDefault();
          }
        }}
      />

      {/* Troubleshooting Dialog */}
      <TroubleshootingDialog
        visible={troubleshootingDialogVisible}
        projectMetadata={projectMetadata}
        projectNotes={projectNotes}
        drawingStrokes={drawingStrokes}
        troubleshootingResults={troubleshootingResults}
        includePcbData={includePcbData}
        onIncludePcbDataChange={setIncludePcbData}
        onRunAnalysis={handleTroubleshootingAnalysis}
        onGetPrompt={handleGetPrompt}
        onClose={() => {
          setTroubleshootingDialogVisible(false);
        }}
        position={troubleshootingDialogPosition}
        isDragging={isDraggingTroubleshootingDialog}
        onDragStart={(e) => {
          if (troubleshootingDialogPosition) {
            setTroubleshootingDialogDragOffset({
              x: e.clientX - troubleshootingDialogPosition.x,
              y: e.clientY - troubleshootingDialogPosition.y,
            });
            setIsDraggingTroubleshootingDialog(true);
            e.preventDefault();
          } else {
            // Initialize position on first drag
            setTroubleshootingDialogPosition({ x: e.clientX - 300, y: e.clientY - 200 });
            setTroubleshootingDialogDragOffset({ x: 300, y: 200 });
            setIsDraggingTroubleshootingDialog(true);
            e.preventDefault();
          }
        }}
        isAnalyzing={isAnalyzing}
      />
      
      {/* Net Name Suggestion Dialog */}
      {netNameSuggestionDialogVisible && (
        <NetNameSuggestionDialog
          suggestions={netNameSuggestions}
          onApply={handleApplyNetNameSuggestions}
          onCancel={handleCancelNetNameSuggestions}
          position={netNameSuggestionDialogPosition}
          onDragStart={(e) => {
            setNetNameSuggestionDialogDragOffset({
              x: e.clientX - netNameSuggestionDialogPosition.x,
              y: e.clientY - netNameSuggestionDialogPosition.y,
            });
            setIsDraggingNetNameSuggestionDialog(true);
          }}
        />
      )}

      {/* Test Points Dialog */}
      <TestPointsDialog
        visible={testPointsDialogVisible}
        drawingStrokes={drawingStrokes}
        onClose={() => {
          setTestPointsDialogVisible(false);
          // Don't reset position - keep it for next time
        }}
        onFindTestPoint={findAndCenterTestPoint}
        position={testPointsDialogPosition}
        isDragging={isDraggingTestPointsDialog}
        onDragStart={(e) => {
          if (testPointsDialogPosition) {
            setTestPointsDialogDragOffset({
              x: e.clientX - testPointsDialogPosition.x,
              y: e.clientY - testPointsDialogPosition.y,
            });
            setIsDraggingTestPointsDialog(true);
            e.preventDefault();
          } else {
            // Initialize position on first drag
            setTestPointsDialogPosition({ x: e.clientX - 300, y: e.clientY - 200 });
            setTestPointsDialogDragOffset({ x: 300, y: 200 });
            setIsDraggingTestPointsDialog(true);
            e.preventDefault();
          }
        }}
        determineTestPointType={determineTestPointType}
        powerBuses={powerBuses}
      />

      {/* New Project Confirmation Dialog */}
      <ConfirmationDialog
        visible={newProjectDialog.visible}
        title="New Project"
        message="You have unsaved changes. Do you want to save your project before creating a new one?"
        onYes={handleNewProjectYes}
        onNo={handleNewProjectNo}
        onCancel={handleNewProjectCancel}
        yesButtonRef={newProjectYesButtonRef}
      />


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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
            <div style={{ 
              marginBottom: '12px', 
              padding: '6px 10px', 
              background: '#2a2a2f', 
              border: '1px solid #444', 
              borderRadius: 4,
              fontSize: '11px',
              color: '#aaa',
              fontStyle: 'italic',
            }}>
              Note: Select an existing parent directory. The project directory will be created automatically when you click Create.
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
                  {(() => {
                    if (!newProjectSetupDialog.projectName || !newProjectSetupDialog.locationPath) {
                      return '';
                    }
                    // Sanitize the project name the same way handleNewProjectCreate does
                    const projectNameInput = newProjectSetupDialog.projectName.trim();
                    const cleanName = projectNameInput.replace(/[^a-zA-Z0-9_-]/g, '_');
                    if (!cleanName) {
                      return '';
                    }
                    const filename = `${cleanName}.json`;
                    // Smart path preview: If selected folder matches project name, don't show redundant subfolder
                    if (newProjectSetupDialog.locationPath === cleanName) {
                      return `${newProjectSetupDialog.locationPath}/${filename}`;
                    }
                    return `${newProjectSetupDialog.locationPath}/${cleanName}/${filename}`;
                  })()}
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
          // Note: Dimensions are saved in project file, not localStorage
        }}
        onClose={() => setShowBoardDimensionsDialog(false)}
      />

      <TransformImagesDialog
        visible={transformImagesDialogVisible}
        onClose={() => {
          // Save current view as origin view when dialog closes
          // Use top image center as reference (or bottom image if no top image)
          let pcbRefX = 0;
          let pcbRefY = 0;
          if (topImage) {
            pcbRefX = topImage.x;
            pcbRefY = topImage.y;
          } else if (bottomImage) {
            pcbRefX = bottomImage.x;
            pcbRefY = bottomImage.y;
          }
          
          // Save as origin view (we'll use a special marker or slot 0)
          // For now, we'll use a convention: if pcbReferenceX/Y are undefined, it's the origin view
          // Or we could use slot -1 or a special property. Let's use slot 0 as the origin view.
          setHomeViews(prev => ({
            ...prev,
            0: { // Slot 0 is the origin view
              pcbReferenceX: pcbRefX,
              pcbReferenceY: pcbRefY,
              x: 0, // Legacy field
              y: 0, // Legacy field
              zoom: viewScale,
              viewRotation,
              viewFlipX,
              isBottomView,
              transparency,
              showTopImage,
              showBottomImage,
              showViasLayer,
              showTopTracesLayer,
              showBottomTracesLayer,
              showTopPadsLayer,
              showBottomPadsLayer,
              showTopTestPointsLayer,
              showBottomTestPointsLayer,
              showTopComponents,
              showBottomComponents,
              showPowerLayer,
              showGroundLayer,
              showConnectionsLayer,
            }
          }));
          
          setTransformImagesDialogVisible(false);
        }}
        topImage={topImage}
        bottomImage={bottomImage}
        selectedImageForTransform={selectedImageForTransform}
        setSelectedImageForTransform={setSelectedImageForTransform}
        transformMode={transformMode}
        setTransformMode={setTransformMode}
        updateImageTransform={updateImageTransform}
        resetImageTransform={resetImageTransform}
        setCurrentTool={setCurrentTool}
        isGrayscale={isGrayscale}
        setIsGrayscale={setIsGrayscale}
        areImagesLocked={areImagesLocked}
      />

      <TransformAllDialog
        visible={transformAllDialogVisible}
        onClose={() => setTransformAllDialogVisible(false)}
        topImage={topImage}
        bottomImage={bottomImage}
        setTopImage={setTopImage}
        setBottomImage={setBottomImage}
        componentsTop={componentsTop}
        componentsBottom={componentsBottom}
        setComponentsTop={setComponentsTop}
        setComponentsBottom={setComponentsBottom}
        drawingStrokes={drawingStrokes}
        setDrawingStrokes={setDrawingStrokes}
        powerSymbols={powers}
        groundSymbols={grounds}
        setPowerSymbols={setPowerSymbols}
        setGroundSymbols={setGroundSymbols}
        canvasRef={canvasRef}
        isBottomView={isBottomView}
        setIsBottomView={setIsBottomView}
        originalTopFlipX={originalTopFlipX}
        setOriginalTopFlipX={setOriginalTopFlipX}
        originalBottomFlipX={originalBottomFlipX}
        setOriginalBottomFlipX={setOriginalBottomFlipX}
        originalTopFlipY={originalTopFlipY}
        setOriginalTopFlipY={setOriginalTopFlipY}
        originalBottomFlipY={originalBottomFlipY}
        setOriginalBottomFlipY={setOriginalBottomFlipY}
        cameraWorldCenter={cameraWorldCenter}
        setCameraWorldCenter={setCameraWorldCenter}
        viewScale={viewScale}
        viewRotation={viewRotation}
        setViewRotation={setViewRotation}
        viewFlipX={viewFlipX}
        setViewFlipX={setViewFlipX}
        contentBorder={CONTENT_BORDER}
        setTransparency={setTransparency}
      />

      {/* Component Selection Dialog */}
      <ComponentSelectionDialog
        visible={showComponentSelectionDialog}
        selectedLayer={componentToolLayer}
        selectedComponentType={selectedComponentType}
        selectedComponentKey={selectedComponentKey}
        onLayerChange={(layer) => {
          setComponentToolLayer(layer);
          componentToolLayerRef.current = layer;
          setSelectedDrawingLayer(layer);
          setBrushColor(layer === 'top' ? topComponentColor : bottomComponentColor);
          setBrushSize(layer === 'top' ? topComponentSize : bottomComponentSize);
          if (layer === 'top') {
            setShowTopImage(true);
            setShowTopComponents(true);
          } else {
            setShowBottomImage(true);
            setShowBottomComponents(true);
          }
        }}
        onComponentTypeChange={(componentType, uniqueKey, metadata) => {
          setSelectedComponentType(componentType);
          setSelectedComponentKey(uniqueKey);
          setSelectedComponentMetadata(metadata || null);
          lastSelectedComponentTypeRef.current = componentType;
        }}
        onClose={() => {
          // User explicitly closed the dialog; remember this so it is not auto-reopened
          // while the Component tool remains active.
          setShowComponentSelectionDialog(false);
          setHasDismissedComponentDialog(true);
          // Activate Select tool when dialog closes
          setCurrentTool('select');
        }}
      />

      {/* Set Size Dialog */}
      <SetSizeDialog
        visible={setSizeDialog.visible}
        size={setSizeDialog.size}
        onSizeChange={(size) => setSetSizeDialog(prev => ({ ...prev, size }))}
        onApply={handleSetSizeApply}
        onCancel={() => setSetSizeDialog({ visible: false, size: 6 })}
      />

      {/* Auto Save Dialog */}
      <AutoSaveDialog
        visible={autoSaveDialog.visible}
        interval={autoSaveDialog.interval}
        onIntervalChange={(interval) => setAutoSaveDialog({ visible: true, interval })}
        onApply={() => handleAutoSaveApply(autoSaveDialog.interval, false)}
        onCancel={() => setAutoSaveDialog({ visible: false, interval: 5 })}
            />
            
      {/* Auto Save Prompt Dialog (shown after New Project or Open Project) - Combined with interval selector */}
      <AutoSavePromptDialog
        visible={autoSavePromptDialog.visible}
        interval={autoSavePromptDialog.interval}
        onIntervalChange={(interval) => setAutoSavePromptDialog({ ...autoSavePromptDialog, interval })}
        onEnable={() => handleAutoSaveApply(autoSavePromptDialog.interval, true)}
        onSkip={handleAutoSavePromptSkip}
      />

      {/* IC Placement Dialog */}
      <ICPlacementDialog
        visible={showICPlacementDialog}
        isPad={icPlacementIsPad}
        onConfirm={(options) => {
          setICPlacementOptions({
            numPins: options.numPins,
            type: options.type,
            twoSidedOrientation: options.twoSidedOrientation,
            zigzagOrientation: options.zigzagOrientation,
            point1: { x: 0, y: 0 }, // Will be set on click
            point2: { x: 0, y: 0 }, // Will be set on release
          } as ICComponentInput);
          setIsICPlacementMode(true);
          setCurrentTool('select'); // Ensure we're in select tool mode
          setShowICPlacementDialog(false);
        }}
        onClose={() => {
          setShowICPlacementDialog(false);
        }}
      />

      {/* Change Size Dialog */}
      {changeSizeDialog.visible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setChangeSizeDialog({ visible: false, size: 10 })}
        >
          <div
            style={{
              background: '#2b2b31',
              borderRadius: 8,
              padding: 24,
              minWidth: 300,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#f2f2f2', fontSize: 16 }}>Change Size</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#aaa', fontSize: 13, marginBottom: 6 }}>
                New Size:
              </label>
              <input
                type="number"
                value={changeSizeDialog.size}
                onChange={(e) => setChangeSizeDialog({ ...changeSizeDialog, size: parseFloat(e.target.value) || 1 })}
                min={1}
                max={100}
                step={1}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#1a1a1f',
                  color: '#e0e0e0',
                  fontSize: 14,
                  outline: 'none',
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleApplyChangeSize();
                  } else if (e.key === 'Escape') {
                    setChangeSizeDialog({ visible: false, size: 10 });
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setChangeSizeDialog({ visible: false, size: 10 })}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid #555',
                  background: 'transparent',
                  color: '#ccc',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyChangeSize}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#4a90d9',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Color Dialog */}
      {changeColorDialog.visible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setChangeColorDialog({ visible: false, color: '#ff0000' })}
        >
          <div
            style={{
              background: '#2b2b31',
              borderRadius: 8,
              padding: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#f2f2f2', fontSize: 16 }}>Change Color</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#aaa', fontSize: 13, marginBottom: 8 }}>
                Selected Color:
              </label>
              <div
                style={{
                  width: 48,
                  height: 32,
                  backgroundColor: changeColorDialog.color,
                  border: '1px solid #555',
                  borderRadius: 4,
                  marginBottom: 12,
                }}
                title={changeColorDialog.color}
              />
            </div>
            {/* Color palette grid - same as toolbar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 24px)', gap: 4 }}>
              {palette8x8.map((c) => (
                <div
                  key={c}
                  onClick={() => {
                    setChangeColorDialog({ ...changeColorDialog, color: c });
                  }}
                  title={c}
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: c,
                    border: c === changeColorDialog.color ? '2px solid #fff' : '1px solid #555',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setChangeColorDialog({ visible: false, color: '#ff0000' })}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid #555',
                  background: 'transparent',
                  color: '#ccc',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyChangeColor}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#4a90d9',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
