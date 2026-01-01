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

// ============================================================================
// Project Isolation Module
// ============================================================================
// CRITICAL: This module ensures complete project isolation by clearing ALL state
// when switching between projects. This prevents state leakage between projects.

import React from 'react';
import { toolInstanceManager } from '../toolInstances';
import { resetPointIdCounter } from '../coordinates';
import type { 
  PCBImage, 
  DrawingStroke, 
  PCBComponent, 
  ViewMode,
  Tool,
  TransformMode,
  HomeView
} from '../../types';
import type { PowerSymbol, PowerBus, GroundBus } from '../../hooks/usePowerGround';
import type { ProjectMetadata } from '../../components/ProjectNotesDialog';

// DrawingMode type (matches useDrawing hook)
type DrawingMode = 'trace' | 'via' | 'pad' | 'testPoint';

/**
 * Comprehensive interface for all state setters and refs needed for project isolation
 */
export interface ProjectIsolationState {
  // File operation setters
  setProjectDirHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setAutoSaveDirHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setCurrentProjectFilePath: (path: string) => void;
  setProjectName: (name: string) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number | null) => void;
  setAutoSaveBaseName: (name: string) => void;
  setAutoSaveFileHistory: (history: string[]) => void;
  setCurrentFileIndex: (index: number) => void;
  setHasUnsavedChangesState: (hasChanges: boolean) => void;
  
  // Image setters
  setTopImage: (image: PCBImage | null) => void;
  setBottomImage: (image: PCBImage | null) => void;
  
  // Drawing setters
  setDrawingStrokes: (strokes: DrawingStroke[]) => void;
  setCurrentStroke: (stroke: any[]) => void;
  setVias: (vias: any[]) => void;
  setPads: (pads: any[]) => void;
  setTracesTop: (traces: any[]) => void;
  setTracesBottom: (traces: any[]) => void;
  
  // Component setters
  setComponentsTop: (components: PCBComponent[]) => void;
  setComponentsBottom: (components: PCBComponent[]) => void;
  setComponentEditor: (editor: any) => void;
  setConnectingPin: (pin: any) => void;
  
  // Power/Ground setters
  setPowerSymbols: (symbols: PowerSymbol[] | ((prev: PowerSymbol[]) => PowerSymbol[])) => void;
  setGroundSymbols: (symbols: any) => void; // Accept any to handle type differences between hooks and types
  setPowerEditor: (editor: any) => void;
  setPowerBuses: (buses: PowerBus[]) => void;
  setGroundBuses: (buses: GroundBus[]) => void;
  
  // Selection setters
  setSelectedIds: (ids: Set<string>) => void;
  setSelectedComponentIds: (ids: Set<string>) => void;
  setSelectedPowerIds: (ids: Set<string>) => void;
  setSelectedGroundIds: (ids: Set<string>) => void;
  setIsSelecting: (selecting: boolean) => void;
  
  // Project notes setter
  setProjectNotes: (notes: any[]) => void;
  setProjectMetadata: (metadata: ProjectMetadata) => void;
  
  // View setters
  setCurrentView: (view: ViewMode) => void;
  setViewScale: (scale: number) => void;
  setCameraCenter: (x: number, y: number) => void;
  setCameraWorldCenter: (center: { x: number; y: number }) => void;
  setShowBothLayers: (show: boolean) => void;
  setSelectedDrawingLayer: (layer: 'top' | 'bottom') => void;
  setHomeViews: (views: Record<number, HomeView>) => void;
  setIsWaitingForHomeViewKey: (waiting: boolean) => void;
  
  // Transform setters
  setSelectedImageForTransform: (image: 'top' | 'bottom' | null) => void;
  setIsTransforming: (transforming: boolean) => void;
  setTransformStartPos: (pos: { x: number; y: number } | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  setIsBottomView: (isBottom: boolean) => void;
  setOriginalTopFlipX: (flipX: boolean | null) => void;
  setOriginalBottomFlipX: (flipX: boolean | null) => void;
  
  // Image filter setters
  setIsGrayscale: (grayscale: boolean) => void;
  setTransparency: (transparency: number) => void;
  setIsTransparencyCycling: (cycling: boolean) => void;
  setTransparencyCycleSpeed: (speed: number) => void;
  
  // Lock setters
  setAreImagesLocked: (locked: boolean) => void;
  setAreViasLocked: (locked: boolean) => void;
  setArePadsLocked: (locked: boolean) => void;
  setAreTestPointsLocked: (locked: boolean) => void;
  setAreTracesLocked: (locked: boolean) => void;
  setAreComponentsLocked: (locked: boolean) => void;
  setAreGroundNodesLocked: (locked: boolean) => void;
  setArePowerNodesLocked: (locked: boolean) => void;
  
  // Visibility setters
  setShowTopImage: (show: boolean) => void;
  setShowBottomImage: (show: boolean) => void;
  setShowViasLayer: (show: boolean) => void;
  setShowTopTracesLayer: (show: boolean) => void;
  setShowBottomTracesLayer: (show: boolean) => void;
  setShowTopPadsLayer: (show: boolean) => void;
  setShowBottomPadsLayer: (show: boolean) => void;
  setShowTopTestPointsLayer: (show: boolean) => void;
  setShowBottomTestPointsLayer: (show: boolean) => void;
  setShowTopComponents: (show: boolean) => void;
  setShowBottomComponents: (show: boolean) => void;
  setShowPowerLayer: (show: boolean) => void;
  setShowGroundLayer: (show: boolean) => void;
  setShowConnectionsLayer: (show: boolean) => void;
  setShowTraceCornerDots: (show: boolean) => void;
  setShowTraceEndDots: (show: boolean) => void;
  
  // Tool setters
  setCurrentTool: (tool: Tool) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setTraceToolLayer: (layer: 'top' | 'bottom') => void;
  setPadToolLayer: (layer: 'top' | 'bottom') => void;
  setTestPointToolLayer: (layer: 'top' | 'bottom') => void;
  setComponentToolLayer: (layer: 'top' | 'bottom') => void;
  
  // Designator setters
  setAutoAssignDesignators: (auto: boolean) => void;
  setUseGlobalDesignatorCounters: (use: boolean) => void;
  
  // Dialog setters
  setOpenMenu: (menu: 'file' | 'transform' | 'tools' | 'about' | 'help' | null) => void;
  setDebugDialog: (dialog: { visible: boolean; text: string }) => void;
  setErrorDialog: (dialog: { visible: boolean; title: string; message: string }) => void;
  setNewProjectDialog: (dialog: { visible: boolean }) => void;
  setOpenProjectDialog: (dialog: { visible: boolean }) => void;
  setNewProjectSetupDialog: (dialog: { visible: boolean; projectName: string; locationPath: string; locationHandle: FileSystemDirectoryHandle | null }) => void;
  setSaveAsDialog: (dialog: { visible: boolean; filename: string; locationPath: string; locationHandle: FileSystemDirectoryHandle | null }) => void;
  setAutoSaveDialog: (dialog: { visible: boolean; interval: number | null }) => void;
  setAutoSavePromptDialog: (dialog: { visible: boolean; source: 'new' | 'open' | null; interval: number }) => void;
  setShowColorPicker: (show: boolean) => void;
  setShowPowerBusManager: (show: boolean) => void;
  setShowGroundBusManager: (show: boolean) => void;
  setShowDesignatorManager: (show: boolean) => void;
  setShowBoardDimensionsDialog: (show: boolean) => void;
  setNotesDialogVisible: (visible: boolean) => void;
  setProjectNotesDialogVisible: (visible: boolean) => void;
  setTransformImagesDialogVisible: (visible: boolean) => void;
  setTransformAllDialogVisible: (visible: boolean) => void;
  
  // Other setters
  setBoardDimensions: (dims: any) => void; // Accept any to handle type differences
  setHoverComponent: (component: any) => void; // Accept any to handle type differences
  setHoverTestPoint: (testPoint: any) => void;
  setIsPanning: (panning: boolean) => void;
  setIsDrawing: (drawing: boolean) => void;
  setTracePreviewMousePos: (pos: { x: number; y: number } | null) => void;
  
  // Undo hook
  clearSnapshot: () => void;
  
  // Refs
  projectDirHandleRef: React.MutableRefObject<FileSystemDirectoryHandle | null>;
  autoSaveDirHandleRef: React.MutableRefObject<FileSystemDirectoryHandle | null>;
  autoSaveBaseNameRef: React.MutableRefObject<string>;
  autoSaveIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  hasChangesSinceLastAutoSaveRef: React.MutableRefObject<boolean>;
  currentProjectFilePathRef: React.MutableRefObject<string>;
  autoSaveFileHistoryRef: React.MutableRefObject<string[]>;
  currentFileIndexRef: React.MutableRefObject<number>;
  currentStrokeRef: React.MutableRefObject<any[]>;
  sessionDesignatorCountersRef: React.MutableRefObject<Record<string, number>>;
  traceToolLayerRef: React.MutableRefObject<'top' | 'bottom'>;
  padToolLayerRef: React.MutableRefObject<'top' | 'bottom'>;
  testPointToolLayerRef: React.MutableRefObject<'top' | 'bottom'>;
  componentToolLayerRef: React.MutableRefObject<'top' | 'bottom'>;
  homeViewTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  panStartRef: React.MutableRefObject<any>; // Accept any to handle complex pan state structure
  panClientStartRef: React.MutableRefObject<any>; // Accept any to handle complex pan state structure
  lastTraceClickTimeRef: React.MutableRefObject<number>;
  isDoubleClickingTraceRef: React.MutableRefObject<boolean>;
}

/**
 * Create a function to close the current project and clear all state
 * This is the foundation for preventing state leakage between projects
 */
export function createCloseProject(state: ProjectIsolationState): () => void {
  return () => {
    console.log('closeProject: Starting comprehensive state clearing...');
    
    // === STEP 1: Release browser file system permissions ===
    state.setProjectDirHandle(null);
    state.setAutoSaveDirHandle(null);
    
    // Clear refs that hold directory handles
    if (state.projectDirHandleRef) {
      state.projectDirHandleRef.current = null;
    }
    if (state.autoSaveDirHandleRef) {
      state.autoSaveDirHandleRef.current = null;
    }
    
    // === STEP 2: Clear file operation state ===
    state.setCurrentProjectFilePath('');
    state.setProjectName('');
    state.setAutoSaveEnabled(false);
    state.setAutoSaveInterval(null);
    state.setAutoSaveBaseName('');
    state.setAutoSaveFileHistory([]);
    state.setCurrentFileIndex(-1);
    
    // Clear auto-save refs
    if (state.autoSaveBaseNameRef) {
      state.autoSaveBaseNameRef.current = '';
    }
    state.hasChangesSinceLastAutoSaveRef.current = false;
    state.setHasUnsavedChangesState(false);
    state.setIsBottomView(false);
    state.setOriginalTopFlipX(null);
    state.setOriginalBottomFlipX(null);
    
    // Clear auto-save interval timer
    if (state.autoSaveIntervalRef.current) {
      clearInterval(state.autoSaveIntervalRef.current);
      state.autoSaveIntervalRef.current = null;
    }
    
    // === STEP 3: Clear all project data ===
    state.setTopImage(null);
    state.setBottomImage(null);
    
    // Clear undo snapshot
    state.clearSnapshot();
    
    // Clear drawing data
    state.setDrawingStrokes([]);
    state.setVias([]);
    state.setPads([]);
    state.setTracesTop([]);
    state.setTracesBottom([]);
    state.setCurrentStroke([]);
    state.currentStrokeRef.current = [];
    
    // Clear components
    state.setComponentsTop([]);
    state.setComponentsBottom([]);
    state.setComponentEditor(null);
    state.setConnectingPin(null);
    
    // Clear power and ground symbols
    state.setPowerSymbols([]);
    state.setGroundSymbols([]);
    state.setPowerEditor(null);
    
    // Reset power buses to defaults
    state.setPowerBuses([
      { id: 'powerbus-default', name: '+5VDC', voltage: '+5', color: '#ff0000' },
    ]);
    
    // Reset ground buses to defaults
    state.setGroundBuses([
      { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
    ]);
    
    // === STEP 4: Clear selections ===
    state.setSelectedIds(new Set());
    state.setSelectedComponentIds(new Set());
    state.setSelectedPowerIds(new Set());
    state.setSelectedGroundIds(new Set());
    state.setIsSelecting(false);
    
    // === STEP 5: Clear project notes and metadata ===
    state.setProjectNotes([]);
    state.setProjectMetadata({
      productName: '',
      productVersion: '',
      manufacturer: '',
      date: new Date().toISOString().split('T')[0],
    });
    
    // === STEP 6: Reset view state ===
    state.setCurrentView('overlay');
    state.setViewScale(1);
    state.setCameraCenter(0, 0);
    state.setShowBothLayers(true);
    state.setSelectedDrawingLayer('top');
    state.setHomeViews({});
    state.setIsWaitingForHomeViewKey(false);
    if (state.homeViewTimeoutRef.current) {
      clearTimeout(state.homeViewTimeoutRef.current);
      state.homeViewTimeoutRef.current = null;
    }
    
    // === STEP 7: Reset transform state ===
    state.setSelectedImageForTransform(null);
    state.setIsTransforming(false);
    state.setTransformStartPos(null);
    state.setTransformMode('nudge');
    
    // === STEP 8: Reset image filters ===
    state.setIsGrayscale(false);
    state.setTransparency(50);
    state.setIsTransparencyCycling(false);
    state.setTransparencyCycleSpeed(2000);
    
    // === STEP 9: Reset lock states ===
    state.setAreImagesLocked(false);
    state.setAreViasLocked(false);
    state.setArePadsLocked(false);
    state.setAreTestPointsLocked(false);
    state.setAreTracesLocked(false);
    state.setAreComponentsLocked(false);
    state.setAreGroundNodesLocked(false);
    state.setArePowerNodesLocked(false);
    
    // === STEP 10: Reset visibility states ===
    state.setShowTopImage(true);
    state.setShowBottomImage(true);
    state.setShowViasLayer(true);
    state.setShowTopTracesLayer(true);
    state.setShowBottomTracesLayer(true);
    state.setShowTopPadsLayer(true);
    state.setShowBottomPadsLayer(true);
    state.setShowTopTestPointsLayer(true);
    state.setShowBottomTestPointsLayer(true);
    state.setShowTopComponents(true);
    state.setShowBottomComponents(true);
    state.setShowPowerLayer(true);
    state.setShowGroundLayer(true);
    state.setShowConnectionsLayer(true);
    state.setShowTraceCornerDots(false);
    state.setShowTraceEndDots(true);
    
    // === STEP 11: Reset tool state ===
    state.setCurrentTool('select');
    state.setDrawingMode('trace');
    state.setTraceToolLayer('top');
    state.setPadToolLayer('top');
    state.setTestPointToolLayer('top');
    state.setComponentToolLayer('top');
    
    // Reset tool layer refs
    state.traceToolLayerRef.current = 'top';
    state.padToolLayerRef.current = 'top';
    state.testPointToolLayerRef.current = 'top';
    state.componentToolLayerRef.current = 'top';
    
    // === STEP 12: Reset designator counters ===
    state.sessionDesignatorCountersRef.current = {};
    state.setAutoAssignDesignators(true);
    state.setUseGlobalDesignatorCounters(false);
    
    // === STEP 13: Reset point ID counter and clear allocated IDs tracking ===
    resetPointIdCounter();
    
    // === STEP 13.5: Reset module-level singleton state ===
    // CRITICAL: Reset toolInstanceManager to prevent state leakage between projects
    toolInstanceManager.initialize();
    
    // === STEP 14: Close all dialogs ===
    state.setOpenMenu(null);
    state.setDebugDialog({ visible: false, text: '' });
    state.setErrorDialog({ visible: false, title: '', message: '' });
    state.setNewProjectDialog({ visible: false });
    state.setOpenProjectDialog({ visible: false });
    state.setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
    state.setSaveAsDialog({ visible: false, filename: '', locationPath: '', locationHandle: null });
    state.setAutoSaveDialog({ visible: false, interval: null });
    state.setAutoSavePromptDialog({ visible: false, source: 'new', interval: 5 });
    state.setShowColorPicker(false);
    state.setShowPowerBusManager(false);
    state.setShowGroundBusManager(false);
    state.setShowDesignatorManager(false);
    state.setShowBoardDimensionsDialog(false);
    state.setNotesDialogVisible(false);
    state.setProjectNotesDialogVisible(false);
    state.setTransformImagesDialogVisible(false);
    state.setTransformAllDialogVisible(false);
    
    // === STEP 15: Reset board dimensions ===
    state.setBoardDimensions(null);
    
    // === STEP 16: Clear hover states ===
    state.setHoverComponent(null);
    state.setHoverTestPoint(null);
    
    // === STEP 17: Reset panning state ===
    state.setIsPanning(false);
    state.panStartRef.current = null;
    state.panClientStartRef.current = null;
    
    // === STEP 18: Reset drawing state ===
    state.setIsDrawing(false);
    state.setTracePreviewMousePos(null);
    state.lastTraceClickTimeRef.current = 0;
    state.isDoubleClickingTraceRef.current = false;
    
    console.log('closeProject: All state cleared and browser permissions released');
  };
}

/**
 * Ensure complete project isolation before opening/creating a new project
 * This function ensures NO state information can leak from the previous project to the new one
 */
export async function ensureProjectIsolation(closeProject: () => void): Promise<void> {
  console.log('Ensuring project isolation: Starting comprehensive cleanup...');
  closeProject(); // STEP 1: Close current project (clears all React state, refs, timers, permissions)
  await new Promise(resolve => setTimeout(resolve, 150)); // STEP 2: Wait for React state updates
  toolInstanceManager.initialize(); // STEP 3: Reset module-level singleton state
  resetPointIdCounter();
  await new Promise(resolve => setTimeout(resolve, 50)); // STEP 4: Additional wait
  console.log('Project isolation complete: All state cleared, safe to proceed with new project');
}
