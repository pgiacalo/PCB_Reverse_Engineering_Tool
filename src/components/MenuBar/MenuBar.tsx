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

import React from 'react';
import type { Tool, ToolDefinition, ToolSettings } from '../../hooks/useToolRegistry';
import type { PCBImage } from '../../hooks/useImage';
import type { DrawingStroke } from '../../hooks/useDrawing';
import type { PCBComponent } from '../../types';
import { SetToolSizeDialog } from '../SetToolSizeDialog';
import { SetToolColorDialog } from '../SetToolColorDialog';

export interface MenuBarProps {
  // Menu state
  openMenu: 'file' | 'transform' | 'tools' | 'about' | 'help' | null;
  setOpenMenu: React.Dispatch<React.SetStateAction<'file' | 'transform' | 'tools' | 'about' | 'help' | null>>;
  
  // Read-only mode
  isReadOnlyMode: boolean;
  currentProjectFilePath: string;
  
  // Project active state - true when a project has been created or opened
  isProjectActive: boolean;
  
  // Save status indicator
  autoSaveEnabled: boolean;
  autoSaveInterval: number | null; // Auto-save interval in minutes
  hasUnsavedChangesState: boolean; // true = changes detected, false = saved (no changes)
  
  // File operations
  onNewProject: () => void;
  onOpenProject: () => Promise<void>;
  onSaveProject: () => Promise<void>;
  onSaveAs: () => void;
  onPrint: () => void;
  onExportBOM: () => Promise<void>;
  hasUnsavedChanges: () => boolean;
  
  // Settings
  bomExportFormat: 'json' | 'pdf';
  setBomExportFormat: (format: 'json' | 'pdf') => void;
  
  // Dialogs
  setNewProjectDialog: (dialog: { visible: boolean }) => void;
  setAutoSaveDialog: (dialog: { visible: boolean; interval: number | null }) => void;
  
  // Image operations
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  setCurrentTool: (tool: Tool) => void;
  resetImageTransform: () => void;
  areImagesLocked: boolean;
  setAreImagesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Board dimensions
  onEnterBoardDimensions: () => void;
  
  // File input refs
  fileInputTopRef: React.RefObject<HTMLInputElement | null>;
  fileInputBottomRef: React.RefObject<HTMLInputElement | null>;
  openProjectRef: React.RefObject<HTMLInputElement | null>;
  
  // Tools operations
  increaseSize: () => void;
  decreaseSize: () => void;
  brushSize: number;
  drawingStrokes: DrawingStroke[];
  selectedIds: Set<string>;
  selectedComponentIds: Set<string>;
  selectedPowerIds: Set<string>;
  selectedGroundIds: Set<string>;
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  powers: Array<{ id: string; size: number }>;
  grounds: Array<{ id: string; size: number }>;
  powerNodeNames: string[];
  groundNodeNames: string[];
  setSetSizeDialog: (dialog: { visible: boolean; size: number }) => void;
  
  // Locks
  areViasLocked: boolean;
  setAreViasLocked: React.Dispatch<React.SetStateAction<boolean>>;
  arePadsLocked: boolean;
  setArePadsLocked: React.Dispatch<React.SetStateAction<boolean>>;
  areTestPointsLocked: boolean;
  setAreTestPointsLocked: React.Dispatch<React.SetStateAction<boolean>>;
  areTracesLocked: boolean;
  setAreTracesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  areComponentsLocked: boolean;
  setAreComponentsLocked: React.Dispatch<React.SetStateAction<boolean>>;
  areGroundNodesLocked: boolean;
  setAreGroundNodesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  arePowerNodesLocked: boolean;
  setArePowerNodesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Trace display options
  showTraceCornerDots: boolean;
  setShowTraceCornerDots: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Selection operations
  setSelectedIds: (ids: Set<string>) => void;
  setSelectedComponentIds: (ids: Set<string>) => void;
  setSelectedPowerIds: (ids: Set<string>) => void;
  setSelectedGroundIds: (ids: Set<string>) => void;
  
  // Select All functions
  selectAllVias: () => void;
  selectAllTraces: () => void;
  selectAllPads: () => void;
  selectAllComponents: () => void;
  selectDisconnectedComponents: () => void;
  selectAllComponentConnections: () => void;
  selectAllPowerNodes: () => void;
  selectAllGroundNodes: () => void;
  selectPowerNodesByName: (name: string) => void;
  selectGroundNodesByName: (name: string) => void;
  
  // Power bus
  setShowPowerBusManager: (show: boolean) => void;
  // Ground bus
  setShowGroundBusManager: (show: boolean) => void;
  // Designator management
  setShowDesignatorManager: (show: boolean) => void;
  // PastMachine
  setShowPastMachine: (show: boolean) => void;
  
  // Tool registry
  toolRegistry: Map<string, ToolDefinition>;
  updateToolSettings: (toolId: string, settings: ToolSettings) => void;
  updateToolLayerSettings: (toolId: string, layer: 'top' | 'bottom', settings: ToolSettings) => void;
  setBrushSize: (size: number | ((prev: number) => number)) => void;
  setBrushColor: (color: string | ((prev: string) => string)) => void;
  saveToolSettings: (toolId: string, color: string, size: number) => void;
  saveToolLayerSettings: (toolId: string, layer: 'top' | 'bottom', color: string, size: number) => void;
  colorPalette: string[];
  
  // Current tool state (to determine if size change should affect brushSize immediately)
  currentTool: Tool;
  drawingMode: 'trace' | 'via' | 'pad' | 'testPoint';
  traceToolLayer: 'top' | 'bottom';
  padToolLayer: 'top' | 'bottom';
  testPointToolLayer: 'top' | 'bottom';
  componentToolLayer: 'top' | 'bottom';
  
  // Layer-specific size setters
  setTopTraceSize: (size: number) => void;
  setBottomTraceSize: (size: number) => void;
  setTopPadSize: (size: number) => void;
  setBottomPadSize: (size: number) => void;
  setTopTestPointSize: (size: number) => void;
  setBottomTestPointSize: (size: number) => void;
  setTopComponentSize: (size: number) => void;
  setBottomComponentSize: (size: number) => void;
  setComponentConnectionSize: (size: number) => void;
  
  // Layer-specific color getters (to get current color when updating size)
  topTraceColor: string;
  bottomTraceColor: string;
  topPadColor: string;
  bottomPadColor: string;
  topTestPointColor: string;
  bottomTestPointColor: string;
  topComponentColor: string;
  bottomComponentColor: string;
  
  // Layer-specific color setters
  setTopTraceColor: (color: string) => void;
  setBottomTraceColor: (color: string) => void;
  setTopPadColor: (color: string) => void;
  setBottomPadColor: (color: string) => void;
  setTopTestPointColor: (color: string) => void;
  setBottomTestPointColor: (color: string) => void;
  setTopComponentColor: (color: string) => void;
  setBottomComponentColor: (color: string) => void;
  setComponentConnectionColor: (color: string) => void;
  
  // Save functions (used by +/- keys)
  saveDefaultSize: (toolType: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'componentConnection' | 'power' | 'ground' | 'brush', size: number, layer?: 'top' | 'bottom') => void;
  saveDefaultColor: (type: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'componentConnection' | 'brush', color: string, layer?: 'top' | 'bottom') => void;
  
  // Menu bar ref
  menuBarRef: React.RefObject<HTMLDivElement | null>;
  // Project Notes Dialog
  onOpenProjectNotes: () => void;
  // Transform Images Dialog
  onOpenTransformImages: () => void;
  // Transform All Dialog
  onOpenTransformAll: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  openMenu,
  setOpenMenu,
  isReadOnlyMode,
  currentProjectFilePath,
  isProjectActive,
  autoSaveEnabled,
  autoSaveInterval,
  hasUnsavedChangesState,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveAs,
  onPrint,
  onExportBOM,
  hasUnsavedChanges,
  bomExportFormat,
  setBomExportFormat,
  setNewProjectDialog,
  setAutoSaveDialog,
  topImage,
  bottomImage,
  setCurrentTool,
  resetImageTransform,
  areImagesLocked,
  setAreImagesLocked,
  onEnterBoardDimensions,
  fileInputTopRef,
  fileInputBottomRef,
  openProjectRef: _openProjectRef,
  increaseSize,
  decreaseSize,
  brushSize: _brushSize,
  drawingStrokes,
  selectedIds: _selectedIds,
  selectedComponentIds: _selectedComponentIds,
  selectedPowerIds: _selectedPowerIds,
  selectedGroundIds: _selectedGroundIds,
  componentsTop: _componentsTop,
  componentsBottom: _componentsBottom,
  powers: _powers,
  grounds: _grounds,
  powerNodeNames,
  groundNodeNames,
  setSetSizeDialog: _setSetSizeDialog,
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
  showTraceCornerDots,
  setShowTraceCornerDots,
  setSelectedIds: _setSelectedIds,
  setSelectedComponentIds: _setSelectedComponentIds,
  setSelectedPowerIds: _setSelectedPowerIds,
  setSelectedGroundIds: _setSelectedGroundIds,
  selectAllVias,
  selectAllTraces,
  selectAllPads,
  selectAllComponents,
  selectDisconnectedComponents,
  selectAllComponentConnections,
  selectAllPowerNodes,
  selectAllGroundNodes,
  selectPowerNodesByName,
  selectGroundNodesByName,
  setShowPowerBusManager,
  setShowGroundBusManager,
  setShowDesignatorManager,
  setShowPastMachine,
  toolRegistry,
  updateToolSettings,
  updateToolLayerSettings,
  setBrushSize,
  setBrushColor,
  saveToolSettings,
  saveToolLayerSettings,
  colorPalette,
  currentTool,
  drawingMode,
  traceToolLayer,
  padToolLayer,
  testPointToolLayer,
  componentToolLayer,
  setTopTraceSize,
  setBottomTraceSize,
  setTopPadSize,
  setBottomPadSize,
  setTopTestPointSize,
  setBottomTestPointSize,
  setTopComponentSize,
  setBottomComponentSize,
  setComponentConnectionSize,
  topTraceColor: _topTraceColor,
  bottomTraceColor: _bottomTraceColor,
  topPadColor: _topPadColor,
  bottomPadColor: _bottomPadColor,
  topTestPointColor: _topTestPointColor,
  bottomTestPointColor: _bottomTestPointColor,
  topComponentColor: _topComponentColor,
  bottomComponentColor: _bottomComponentColor,
  setTopTraceColor,
  setBottomTraceColor,
  setTopPadColor,
  setBottomPadColor,
  setTopTestPointColor,
  setBottomTestPointColor,
  setTopComponentColor,
  setBottomComponentColor,
  setComponentConnectionColor,
  saveDefaultSize,
  saveDefaultColor,
  menuBarRef,
  onOpenProjectNotes,
  onOpenTransformImages,
  onOpenTransformAll,
}) => {
  // Track which node selection submenu is open (power or ground)
  const [openSelectNodesSubmenu, setOpenSelectNodesSubmenu] = React.useState<'power' | 'ground' | null>(null);
  const selectSubmenuTimeoutRef = React.useRef<number | null>(null);

  // Track which Tools submenu is open (Lock or Select)
  const [openToolsSubmenu, setOpenToolsSubmenu] = React.useState<'lock' | 'select' | null>(null);
  const toolsSubmenuTimeoutRef = React.useRef<number | null>(null);
  
  // Track Settings submenu
  const [openSettingsSubmenu, setOpenSettingsSubmenu] = React.useState(false);
  const settingsSubmenuTimeoutRef = React.useRef<number | null>(null);
  
  // Dialog visibility state
  const [setToolSizeDialogVisible, setSetToolSizeDialogVisible] = React.useState(false);
  const [setToolColorDialogVisible, setSetToolColorDialogVisible] = React.useState(false);

  // Helper function to check if project is active before allowing menu actions
  // Returns true if action should proceed, false if blocked
  const requireProject = (action: () => void | Promise<void>): void => {
    if (!isProjectActive) {
      alert('Please create a new project (File → New Project) or open an existing project (File → Open Project) before using this feature.');
            setOpenMenu(null);
      return;
    }
    const result = action();
    // If action returns a Promise, handle it (but don't await - this is fire-and-forget)
    if (result instanceof Promise) {
      result.catch((e) => {
        console.error('Error in requireProject action:', e);
      });
    }
  };

  const renderSelectNodesSubmenu = (type: 'power' | 'ground') => {
    const names = type === 'power' ? powerNodeNames : groundNodeNames;
    const hasNames = names.length > 0;
    const title = type === 'power' ? 'Select Power Nodes' : 'Select Ground Nodes';

    return (
      <div
        onMouseEnter={() => {
          if (selectSubmenuTimeoutRef.current) {
            clearTimeout(selectSubmenuTimeoutRef.current);
            selectSubmenuTimeoutRef.current = null;
          }
          setOpenSelectNodesSubmenu(type);
        }}
        onMouseLeave={() => {
          selectSubmenuTimeoutRef.current = window.setTimeout(() => {
            setOpenSelectNodesSubmenu(prev => prev === type ? null : prev);
          }, 200);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: '4px',
          minWidth: 220,
          background: '#2b2b31',
          border: '1px solid #1f1f24',
          borderRadius: 6,
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          padding: 6,
          zIndex: 10,
        }}
      >
        <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>
          {title} by Name
        </div>
        <button
          onClick={() => {
            if (type === 'power') {
              selectAllPowerNodes();
            } else {
              selectAllGroundNodes();
            }
            setOpenSelectNodesSubmenu(null);
            setOpenMenu(null);
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '6px 10px',
            color: '#f2f2f2',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          All {type === 'power' ? 'Power Nodes' : 'Ground Nodes'}
        </button>
        <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
        {hasNames ? (
          names.map(name => (
            <button
              key={name}
              onClick={() => {
                if (type === 'power') {
                  selectPowerNodesByName(name);
                } else {
                  selectGroundNodesByName(name);
                }
                setOpenSelectNodesSubmenu(null);
                setOpenMenu(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                color: '#f2f2f2',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))
        ) : (
          <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>
            No {type === 'power' ? 'power' : 'ground'} nodes available.
          </div>
        )}
      </div>
    );
  };

  // Helper function to render Lock submenu
  const renderLockSubmenu = () => {
    return (
      <div
        onMouseEnter={() => {
          if (toolsSubmenuTimeoutRef.current) {
            clearTimeout(toolsSubmenuTimeoutRef.current);
            toolsSubmenuTimeoutRef.current = null;
          }
          setOpenToolsSubmenu('lock');
        }}
        onMouseLeave={() => {
          toolsSubmenuTimeoutRef.current = window.setTimeout(() => {
            setOpenToolsSubmenu(prev => prev === 'lock' ? null : prev);
          }, 200);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: '4px',
          minWidth: 220,
          background: '#2b2b31',
          border: '1px solid #1f1f24',
          borderRadius: 6,
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          padding: 6,
          zIndex: 10,
        }}
      >
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={areViasLocked}
            onChange={() => { setAreViasLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Vias</span>
        </label>
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={arePadsLocked}
            onChange={() => { setArePadsLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Pads</span>
        </label>
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={areTestPointsLocked}
            onChange={() => { setAreTestPointsLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Test Points</span>
        </label>
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={areTracesLocked}
            onChange={() => { setAreTracesLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Traces</span>
        </label>
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={areComponentsLocked}
            onChange={() => { setAreComponentsLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Components</span>
        </label>
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={areGroundNodesLocked}
            onChange={() => { setAreGroundNodesLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Ground Node</span>
        </label>
        <label
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            color: '#f2f2f2',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={arePowerNodesLocked}
            onChange={() => { setArePowerNodesLocked(prev => !prev); }}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
              width: '16px',
              height: '16px',
              accentColor: '#4a9eff',
            }}
          />
          <span>Lock Power Nodes</span>
        </label>
      </div>
    );
  };

  // Dialogs are now separate components - removed renderSetSizeSubmenu and renderSetColorSubmenu

  // Helper function to render Select submenu
  const renderSelectSubmenu = () => {
    return (
      <div
        onMouseEnter={() => {
          if (toolsSubmenuTimeoutRef.current) {
            clearTimeout(toolsSubmenuTimeoutRef.current);
            toolsSubmenuTimeoutRef.current = null;
          }
          setOpenToolsSubmenu('select');
        }}
        onMouseLeave={() => {
          toolsSubmenuTimeoutRef.current = window.setTimeout(() => {
            setOpenToolsSubmenu(prev => prev === 'select' ? null : prev);
          }, 200);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: '4px',
          minWidth: 220,
          background: '#2b2b31',
          border: '1px solid #1f1f24',
          borderRadius: 6,
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          padding: 6,
          zIndex: 10,
        }}
      >
        <button onClick={() => { selectAllVias(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Vias
        </button>
        <button onClick={() => { selectAllTraces(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Traces
        </button>
        <button onClick={() => { selectAllPads(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Pads
        </button>
        <button onClick={() => { 
            const testPointIds = new Set(drawingStrokes.filter(s => s.type === 'testPoint').map(s => s.id));
            _setSelectedIds(testPointIds);
            _setSelectedComponentIds(new Set());
            _setSelectedPowerIds(new Set());
            _setSelectedGroundIds(new Set());
            setOpenToolsSubmenu(null);
            setOpenMenu(null);
          }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Test Points
        </button>
        <button onClick={() => { selectAllComponents(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Components
        </button>
        <button onClick={() => { selectAllComponentConnections(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Component Connections
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => {
              if (selectSubmenuTimeoutRef.current) {
                clearTimeout(selectSubmenuTimeoutRef.current);
                selectSubmenuTimeoutRef.current = null;
              }
              setOpenSelectNodesSubmenu('power');
            }}
            onMouseLeave={() => {
              selectSubmenuTimeoutRef.current = window.setTimeout(() => {
                setOpenSelectNodesSubmenu(prev => prev === 'power' ? null : prev);
              }, 200);
            }}
            onClick={() => {
              setOpenSelectNodesSubmenu(prev => (prev === 'power' ? null : 'power'));
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 10px',
              color: '#f2f2f2',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Power Nodes ▸
          </button>
          {openSelectNodesSubmenu === 'power' && renderSelectNodesSubmenu('power')}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => {
              if (selectSubmenuTimeoutRef.current) {
                clearTimeout(selectSubmenuTimeoutRef.current);
                selectSubmenuTimeoutRef.current = null;
              }
              setOpenSelectNodesSubmenu('ground');
            }}
            onMouseLeave={() => {
              selectSubmenuTimeoutRef.current = window.setTimeout(() => {
                setOpenSelectNodesSubmenu(prev => prev === 'ground' ? null : prev);
              }, 200);
            }}
            onClick={() => {
              setOpenSelectNodesSubmenu(prev => (prev === 'ground' ? null : 'ground'));
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 10px',
              color: '#f2f2f2',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Ground Nodes ▸
          </button>
          {openSelectNodesSubmenu === 'ground' && renderSelectNodesSubmenu('ground')}
        </div>
        <button onClick={() => { selectDisconnectedComponents(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          Disconnected Components
        </button>
      </div>
    );
  };


  return (
    <>
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
                    onNewProject();
                  }
                }
              }} 
              disabled={isReadOnlyMode}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
            >
              New Project
            </button>
            <button 
              onClick={async () => {
                await onOpenProject();
                setOpenMenu(null);
              }} 
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
            >
              Open Project…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button 
              onClick={() => { if (!isReadOnlyMode) { requireProject(() => { void onSaveProject(); setOpenMenu(null); }); } }} 
              disabled={isReadOnlyMode || !isProjectActive}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (isReadOnlyMode || !isProjectActive) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (isReadOnlyMode || !isProjectActive) ? 'not-allowed' : 'pointer' }}
            >
              Save Project…
            </button>
            <button 
              onClick={() => { if (!isReadOnlyMode) { requireProject(() => { onSaveAs(); setOpenMenu(null); }); } }} 
              disabled={isReadOnlyMode || !isProjectActive}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (isReadOnlyMode || !isProjectActive) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (isReadOnlyMode || !isProjectActive) ? 'not-allowed' : 'pointer' }}
            >
              Save As…
            </button>
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) { 
                  requireProject(() => {
                  setAutoSaveDialog({ visible: true, interval: 5 });
                  setOpenMenu(null);
                  });
                }
              }} 
              disabled={isReadOnlyMode || !isProjectActive}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (isReadOnlyMode || !isProjectActive) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (isReadOnlyMode || !isProjectActive) ? 'not-allowed' : 'pointer' }}
            >
              Auto Save…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button 
              onClick={() => { setShowPastMachine(true); setOpenMenu(null); }} 
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Restore from History…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <div style={{ position: 'relative' }}>
              <button 
                onMouseEnter={() => {
                  if (settingsSubmenuTimeoutRef.current) {
                    clearTimeout(settingsSubmenuTimeoutRef.current);
                    settingsSubmenuTimeoutRef.current = null;
                  }
                  setOpenSettingsSubmenu(true);
                }}
                onMouseLeave={() => {
                  settingsSubmenuTimeoutRef.current = window.setTimeout(() => {
                    setOpenSettingsSubmenu(false);
                  }, 200);
                }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setOpenSettingsSubmenu(!openSettingsSubmenu);
                }} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Settings ▸
              </button>
              {openSettingsSubmenu && (
                <div 
                  onMouseEnter={() => {
                    if (settingsSubmenuTimeoutRef.current) {
                      clearTimeout(settingsSubmenuTimeoutRef.current);
                      settingsSubmenuTimeoutRef.current = null;
                    }
                    setOpenSettingsSubmenu(true);
                  }}
                  onMouseLeave={() => {
                    settingsSubmenuTimeoutRef.current = window.setTimeout(() => {
                      setOpenSettingsSubmenu(false);
                    }, 200);
                  }}
                  style={{ position: 'absolute', top: 0, left: '100%', marginLeft: '4px', minWidth: 200, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6, zIndex: 10 }}
                >
                  <div style={{ padding: '4px 8px', color: '#aaa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>BOM Export Format</div>
                  <label 
                    onClick={(e) => { e.stopPropagation(); setBomExportFormat('pdf'); }}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <input 
                      type="radio" 
                      name="bomFormat" 
                      checked={bomExportFormat === 'pdf'} 
                      onChange={() => setBomExportFormat('pdf')}
                      style={{ marginRight: '8px', cursor: 'pointer', accentColor: '#4a9eff' }}
                    />
                    <span>PDF</span>
                  </label>
                  <label 
                    onClick={(e) => { e.stopPropagation(); setBomExportFormat('json'); }}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <input 
                      type="radio" 
                      name="bomFormat" 
                      checked={bomExportFormat === 'json'} 
                      onChange={() => setBomExportFormat('json')}
                      style={{ marginRight: '8px', cursor: 'pointer', accentColor: '#4a9eff' }}
                    />
                    <span>JSON</span>
                  </label>
                  <div style={{ height: 1, background: '#444', margin: '8px 0' }} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSetToolSizeDialogVisible(true);
                      setOpenMenu(null);
                      setOpenSettingsSubmenu(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      color: '#f2f2f2',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Set Tool Sizes…
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSetToolColorDialogVisible(true);
                      setOpenMenu(null);
                      setOpenSettingsSubmenu(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      color: '#f2f2f2',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Set Tool Colors…
                  </button>
                </div>
              )}
            </div>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button 
              onClick={async () => { 
                if (isReadOnlyMode) return;
                if (!isProjectActive) {
                  alert('Please create a new project (File → New Project) or open an existing project (File → Open Project) before using this feature.');
                  setOpenMenu(null);
                  return;
                }
                try {
                  await onExportBOM(); 
                  setOpenMenu(null); 
                } catch (e) {
                  console.error('Error exporting BOM:', e);
                }
              }} 
              disabled={isReadOnlyMode || !isProjectActive}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (isReadOnlyMode || !isProjectActive) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (isReadOnlyMode || !isProjectActive) ? 'not-allowed' : 'pointer' }}
            >
              Export BOM…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button onClick={() => { requireProject(() => { onPrint(); setOpenMenu(null); }); }} disabled={!isProjectActive} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: !isProjectActive ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: !isProjectActive ? 'not-allowed' : 'pointer' }}>Print…</button>
            <button onClick={() => { requireProject(() => { onPrint(); setOpenMenu(null); }); }} disabled={!isProjectActive} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: !isProjectActive ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: !isProjectActive ? 'not-allowed' : 'pointer' }}>Printer Settings…</button>
          </div>
        )}
      </div>

      {/* Images menu - simplified for now, full implementation would include all transform options */}
      <div style={{ position: 'relative' }}>
        <button 
          onClick={(e) => { 
            if (!isReadOnlyMode) { 
              if (!isProjectActive) {
                alert('Please create a new project (File → New Project) or open an existing project (File → Open Project) before using this feature.');
                return;
              }
              e.stopPropagation(); 
              setOpenMenu(m => m === 'transform' ? null : 'transform'); 
            } 
          }} 
          disabled={isReadOnlyMode || !isProjectActive}
          style={{ 
            padding: '6px 10px', 
            borderRadius: 6, 
            border: '1px solid #ddd', 
            background: openMenu === 'transform' ? '#eef3ff' : '#fff', 
            fontWeight: 600, 
            color: (isReadOnlyMode || !isProjectActive) ? '#999' : '#222',
            cursor: (isReadOnlyMode || !isProjectActive) ? 'not-allowed' : 'pointer',
            opacity: (isReadOnlyMode || !isProjectActive) ? 0.5 : 1
          }}
        >
          Images ▾
        </button>
        {openMenu === 'transform' && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 260, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
            <button 
              onClick={() => { if (!isReadOnlyMode && !areImagesLocked) { fileInputTopRef.current?.click(); setOpenMenu(null); } }} 
              disabled={isReadOnlyMode || areImagesLocked}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (isReadOnlyMode || areImagesLocked) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (isReadOnlyMode || areImagesLocked) ? 'not-allowed' : 'pointer' }}
            >
              Load Top PCB…
            </button>
            <button 
              onClick={() => { if (!isReadOnlyMode && !areImagesLocked) { fileInputBottomRef.current?.click(); setOpenMenu(null); } }} 
              disabled={isReadOnlyMode || areImagesLocked}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (isReadOnlyMode || areImagesLocked) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (isReadOnlyMode || areImagesLocked) ? 'not-allowed' : 'pointer' }}
            >
              Load Bottom PCB…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button 
              onClick={() => { if (!areImagesLocked) { onEnterBoardDimensions(); setOpenMenu(null); } }} 
              disabled={areImagesLocked}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: areImagesLocked ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: areImagesLocked ? 'not-allowed' : 'pointer' }}
            >
              Enter PCB Dimensions…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button 
                onClick={() => { 
                onOpenTransformImages();
                setOpenMenu(null); 
              }} 
              disabled={(!topImage && !bottomImage) || areImagesLocked}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: ((!topImage && !bottomImage) || areImagesLocked) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: ((!topImage && !bottomImage) || areImagesLocked) ? 'not-allowed' : 'pointer' }}
              >
              Transform Images…
              </button>
            <button 
              onClick={() => { if (!areImagesLocked) { setCurrentTool('transform'); resetImageTransform(); setOpenMenu(null); } }} 
              disabled={areImagesLocked || (!topImage && !bottomImage)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (areImagesLocked || (!topImage && !bottomImage)) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (areImagesLocked || (!topImage && !bottomImage)) ? 'not-allowed' : 'pointer' }}
            >
              Reset Transform
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button onClick={() => { setAreImagesLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              {areImagesLocked ? 'Unlock Images ✓' : 'Lock Images'}
            </button>
          </div>
        )}
      </div>

      {/* Tools menu */}
      <div style={{ position: 'relative' }}>
        <button 
          onClick={(e) => { 
            if (!isReadOnlyMode) { 
              if (!isProjectActive) {
                alert('Please create a new project (File → New Project) or open an existing project (File → Open Project) before using this feature.');
                return;
              }
              e.stopPropagation(); 
              setOpenMenu(m => m === 'tools' ? null : 'tools'); 
            } 
          }} 
          disabled={isReadOnlyMode || !isProjectActive}
          style={{ 
            padding: '6px 10px', 
            borderRadius: 6, 
            border: '1px solid #ddd', 
            background: openMenu === 'tools' ? '#eef3ff' : '#fff', 
            fontWeight: 600, 
            color: (isReadOnlyMode || !isProjectActive) ? '#999' : '#222',
            cursor: (isReadOnlyMode || !isProjectActive) ? 'not-allowed' : 'pointer',
            opacity: (isReadOnlyMode || !isProjectActive) ? 0.5 : 1
          }}
        >
          Tools ▾
        </button>
        {openMenu === 'tools' && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 220, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
            <button onClick={() => { onOpenTransformAll(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Change Perspective…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
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
            <div style={{ position: 'relative' }}>
              <button
                onMouseEnter={() => {
                  if (toolsSubmenuTimeoutRef.current) {
                    clearTimeout(toolsSubmenuTimeoutRef.current);
                    toolsSubmenuTimeoutRef.current = null;
                  }
                  setOpenToolsSubmenu('lock');
                }}
                onMouseLeave={() => {
                  toolsSubmenuTimeoutRef.current = window.setTimeout(() => {
                    setOpenToolsSubmenu(prev => prev === 'lock' ? null : prev);
                  }, 200);
                }}
                onClick={() => {
                  setOpenToolsSubmenu(prev => (prev === 'lock' ? null : 'lock'));
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  color: '#f2f2f2',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Lock ▸
              </button>
              {openToolsSubmenu === 'lock' && renderLockSubmenu()}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onMouseEnter={() => {
                  if (toolsSubmenuTimeoutRef.current) {
                    clearTimeout(toolsSubmenuTimeoutRef.current);
                    toolsSubmenuTimeoutRef.current = null;
                  }
                  setOpenToolsSubmenu('select');
                }}
                onMouseLeave={() => {
                  toolsSubmenuTimeoutRef.current = window.setTimeout(() => {
                    setOpenToolsSubmenu(prev => prev === 'select' ? null : prev);
                  }, 200);
                }}
                onClick={() => {
                  setOpenToolsSubmenu(prev => (prev === 'select' ? null : 'select'));
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  color: '#f2f2f2',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Select ▸
              </button>
              {openToolsSubmenu === 'select' && renderSelectSubmenu()}
            </div>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button
              onClick={() => {
                onOpenProjectNotes();
                setOpenMenu(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                color: '#f2f2f2',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Open Project Notes…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button onClick={() => { setShowPowerBusManager(true); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Manage Power Buses…
            </button>
            <button onClick={() => { setShowGroundBusManager(true); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Manage Ground Buses…
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button onClick={() => { setShowDesignatorManager(true); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Manage Designators…
            </button>
            <button 
              onClick={() => { setShowTraceCornerDots(!showTraceCornerDots); setOpenMenu(null); }} 
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {showTraceCornerDots ? '✓ ' : '   '}Show Trace Corner Dots
            </button>
          </div>
        )}
      </div>

      {/* About menu - simplified for now */}
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
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 500, maxWidth: 700, maxHeight: '80vh', background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 20, overflowY: 'auto', zIndex: 100 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 16px 0', color: '#000', fontSize: '20px', fontWeight: 700 }}>Worms: An Electronics Toolkit</h2>
              
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>About</h3>
                <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  A specialized tool useful for both reverse engineering and troubleshooting electronics by tracing and documenting circuit connections from PCB images. This application supports typical 2 to 4 layer PCBs and enables comprehensive PCB analysis and documentation.
                </p>
                <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  This tool can assist in troubleshooting by tracing circuits, holding contextual notes, comparing test results, and documenting findings during the debugging process.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Technology</h3>
                <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  The application runs entirely client-side in the browser, to provide a responsive, interactive drawing experience with no backend server requirements.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Features</h3>
                
                {/* Tools & Shortcuts - Full Width */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Tools &amp; Shortcuts</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '13px', color: '#222' }}>
                    <div>
                      <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li><strong>Select</strong> — <code>S</code></li>
                        <li><strong>Via</strong> — <code>V</code></li>
                        <li><strong>Pad</strong> — <code>P</code></li>
                        <li><strong>Test Point</strong> — <code>Y</code></li>
                        <li><strong>Trace</strong> — <code>T</code></li>
                        <li><strong>Component</strong> — <code>C</code></li>
                        <li><strong>Component Properties</strong> — double-click component</li>
                        <li><strong>Resize Icons</strong> — <code>+</code> / <code>-</code></li>
                      </ul>
                    </div>
                    <div>
                      <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li><strong>Power</strong> — <code>B</code></li>
                        <li><strong>Ground</strong> — <code>G</code></li>
                        <li><strong>Move (Pan)</strong> — <code>H</code></li>
                        <li><strong>Magnify</strong> — <code>M</code></li>
                        <li><strong>Set View</strong> — <code>X</code> then <code>0-9</code> to save view</li>
                        <li><strong>Recall View</strong> — <code>0-9</code> to recall saved view</li>
                        <li><strong>Information Dialog</strong> — <code>I</code></li>
                        <li><strong>Notes Dialog</strong> — <code>N</code></li>
                        <li><strong>Project Notes / TODO</strong> — <code>L</code></li>
                        <li><strong>Undo</strong> — <code>Ctrl</code> + <code>Z</code></li>
                      </ul>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#222' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Arrow Keys</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                      <li><strong>Switch Perspective</strong> — <code>←</code> / <code>→</code> to switch between front/back view (when not in Image Transform mode)</li>
                      <li><strong>Image Transformations</strong> — Arrow keys for scaling, rotating, and adjusting image transformations (when image is selected for transform)</li>
                      <li><strong>Move Selected Components</strong> — Arrow keys to nudge selected components</li>
                    </ul>
                  </div>
                </div>

                {/* Other Features - 2 Column Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Image Management</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Load top and bottom PCB images</li>
                      <li>Image alignment and transformation</li>
                      <li>Transform modes: nudge, scale, rotate, slant, keystone</li>
                      <li>Horizontal and vertical flip controls</li>
                      <li>Brightness and contrast controls</li>
                      <li>Grayscale mode</li>
                      <li>Automated transparency slider</li>
                      <li>Board dimensions configuration</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Drawing Tools</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Draw copper traces (top and bottom layers)</li>
                      <li>Place vias for layer connections</li>
                      <li>Place component pads (SMD and through-hole)</li>
                      <li>Place test points for circuit testing</li>
                      <li>Place and annotate components</li>
                      <li>Place power and ground nodes</li>
                      <li>Erase tool for removing elements</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Layer Management</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>14 independent layers to manage PCB element types</li>
                      <li>Separate top and bottom layer support</li>
                      <li>Layer-specific color customization</li>
                      <li>Layer-specific size controls</li>
                      <li>Layer visibility toggles</li>
                      <li>Overlay view mode</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Component Management</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Component placement with pin counts</li>
                      <li>Pin connection tracking</li>
                      <li>Component type classification</li>
                      <li>Designator and value annotation</li>
                      <li>Component editor dialog</li>
                      <li>Find and center component</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Selection & Locking</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Select individual elements or groups</li>
                      <li>Select all vias, traces, pads, or components</li>
                      <li>Select power/ground nodes by name</li>
                      <li>Select disconnected components</li>
                      <li>Lock/unlock elements by type</li>
                      <li>Image locking for protection</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Power & Ground</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Multiple voltage power nodes</li>
                      <li>Power bus management</li>
                      <li>Ground node placement</li>
                      <li>Ground bus management</li>
                      <li>Node naming and organization</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Customization</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Customizable colors per layer</li>
                      <li>Adjustable brush/tool sizes</li>
                      <li>Size presets for common tools</li>
                      <li>Color palette management</li>
                      <li>Tool settings persistence</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Project Management</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Create, open, and save projects</li>
                      <li>Auto-save with configurable intervals</li>
                      <li>File history automatically saved in history subdirectory when Auto Save is enabled</li>
                      <li>Project Notes / TODO list with spreadsheet-like editing</li>
                      <li>Project file format (JSON)</li>
                      <li>Print functionality</li>
                      <li>Export to KiCad schematic format (future feature, not yet implemented)</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>View Controls</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Zoom in/out with mouse wheel</li>
                      <li>Pan view with hand tool</li>
                      <li>Zoom to fit</li>
                      <li>View mode switching (top/bottom/overlay)</li>
                      <li>Save up to 10 view locations (X + 0-9)</li>
                      <li>Recall saved views instantly (0-9 keys)</li>
                      <li>Change Perspective (Tools menu) - switch between top/bottom view and rotate all elements</li>
                      <li>Detailed information dialog</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px', lineHeight: '1.5' }}>
                  Use the <strong>File</strong> menu to manage projects, the <strong>Images</strong> menu for image loading and transformation, and the <strong>Tools</strong> menu for selection, locking, and customization options.
                </p>
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Future / TODO List</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                  <li>A searchable list of common components</li>
                  <li>Output schematics (perhaps as KiCad files)</li>
                  <li>Dynamic layers</li>
                  <li>Create a desktop version of this application using Electron</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help menu */}
      <div style={{ position: 'relative' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); setOpenMenu(m => m === 'help' ? null : 'help'); }} 
          style={{ 
            padding: '6px 10px', 
            borderRadius: 6, 
            border: '1px solid #ddd', 
            background: openMenu === 'help' ? '#eef3ff' : '#fff', 
            fontWeight: 600, 
            color: '#222'
          }}
        >
          Help ▾
        </button>
        {openMenu === 'help' && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 500, maxWidth: 700, maxHeight: '80vh', background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 20, overflowY: 'auto', zIndex: 100 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 16px 0', color: '#000', fontSize: '20px', fontWeight: 700 }}>Help: Typical Usage Steps</h2>
              
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 1: Create or Open a Project</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>New Project:</strong> File → New Project. Choose a project name and location.</li>
                  <li><strong>Open Project:</strong> File → Open Project. Select an existing project file (.json).</li>
                  <li><strong>Auto-Save:</strong> File → Auto Save → Enable to automatically save your work at regular intervals.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 2: Load PCB Images</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Load Top Image:</strong> Images → Load Top Image. Select your top-side PCB photo (.png or .jpeg).</li>
                  <li><strong>Load Bottom Image:</strong> Images → Load Bottom Image. Select your bottom-side PCB photo.</li>
                  <li>Images are automatically copied to the <code style={{ background: '#1f1f24', padding: '2px 4px', borderRadius: 3, color: '#fff' }}>images/</code> subdirectory.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 3: Align and Transform Images</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Enter Transform Mode:</strong> Images → Transform Images. Select which image (Top or Bottom) to transform.</li>
                  <li><strong>Transform Operations:</strong> Use Move, Nudge, Scale, Rotate, Slant, or Keystone to align images.</li>
                  <li><strong>Image Adjustments:</strong> Adjust brightness, contrast, sharpness, and grayscale as needed.</li>
                  <li><strong>Flip Images:</strong> Use horizontal or vertical flip if your images are mirrored.</li>
                  <li><strong>Arrow Keys:</strong> When transform tool is active, use arrow keys for precise adjustments.</li>
                  <li><strong>Change Perspective:</strong> Tools → Change Perspective (or press <code>E</code>) to switch between top/bottom view or rotate all elements (images, components, traces) together by 90°, 180°, or 270°.</li>
                  <li><strong>Quick Perspective Switch:</strong> Press <code>←</code> or <code>→</code> arrow keys (when not in Image Transform mode) to quickly switch between front/back view.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 4: Set Board Dimensions</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Enter Dimensions:</strong> Images → Enter Board Dimensions. Specify the actual physical dimensions of your PCB.</li>
                  <li>This helps ensure accurate measurements and scaling for your reverse engineering work.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 5: Trace Connections</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Place Vias:</strong> Click the Via tool (<code>V</code>) and click on the PCB where vias connect layers.</li>
                  <li><strong>Place Pads:</strong> Click the Pad tool (<code>P</code>) and mark component pad locations.</li>
                  <li><strong>Place Test Points:</strong> Click the Test Point tool (<code>Y</code>) to mark test points.</li>
                  <li><strong>Draw Traces:</strong> Click the Trace tool (<code>T</code>), select Top or Bottom layer, then click to start a trace. Click again to add segments. Press <code>Enter</code> or click outside to finish.</li>
                  <li><strong>Snapping:</strong> Traces automatically snap to nearby vias, pads, power nodes, and ground nodes.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 6: Place Components</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Place Component:</strong> Click the Component tool (<code>C</code>), select component type, then click on the PCB.</li>
                  <li><strong>Edit Component:</strong> Double-click a component to open the Component Editor dialog.</li>
                  <li><strong>Set Properties:</strong> Enter designator (e.g., R1, C2), value, and other component details.</li>
                  <li><strong>Connect Pins:</strong> Click on pads or vias to connect component pins to the circuit.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 7: Add Power and Ground Nodes</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Manage Power Buses:</strong> Tools → Manage Power Buses to create and configure voltage buses (e.g., +5V, +3.3V).</li>
                  <li><strong>Place Power Nodes:</strong> Click the Power tool (<code>B</code>), select a voltage bus, then click on the PCB.</li>
                  <li><strong>Manage Ground Buses:</strong> Tools → Manage Ground Buses to configure ground connections.</li>
                  <li><strong>Place Ground Nodes:</strong> Click the Ground tool (<code>G</code>), select a ground bus, then click on the PCB.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 8: Add Notes and Documentation</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Element Notes:</strong> Press <code>N</code> to open the Notes dialog for selected elements (vias, pads, traces, etc.).</li>
                  <li><strong>Project Notes:</strong> Press <code>L</code> to open Project Notes / TODO list for general project documentation.</li>
                  <li><strong>Information Dialog:</strong> Press <code>I</code> to see detailed information about selected elements.</li>
                  <li><strong>Find Elements:</strong> Use the Find button in the Information dialog to center and highlight specific elements.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Step 9: Save Your Work</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  <li><strong>Manual Save:</strong> File → Save Project to save your work manually.</li>
                  <li><strong>Auto-Save:</strong> If enabled, your project is automatically saved at regular intervals.</li>
                  <li><strong>History:</strong> Auto-saved versions are stored in the <code style={{ background: '#1f1f24', padding: '2px 4px', borderRadius: 3, color: '#fff' }}>history/</code> subdirectory.</li>
                  <li><strong>Restore from History:</strong> File → Restore from History to access previous versions.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Keyboard Shortcuts</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '13px', color: '#222' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Drawing Tools</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                      <li><strong>Select</strong> — <code>S</code></li>
                      <li><strong>Via</strong> — <code>V</code></li>
                      <li><strong>Pad</strong> — <code>P</code></li>
                      <li><strong>Test Point</strong> — <code>Y</code></li>
                      <li><strong>Trace</strong> — <code>T</code></li>
                      <li><strong>Component</strong> — <code>C</code></li>
                      <li><strong>Power</strong> — <code>B</code></li>
                      <li><strong>Ground</strong> — <code>G</code></li>
                    </ul>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>View & Navigation</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                      <li><strong>Move (Pan)</strong> — <code>H</code></li>
                      <li><strong>Magnify</strong> — <code>M</code></li>
                      <li><strong>Set View</strong> — <code>X</code> then <code>0-9</code></li>
                      <li><strong>Recall View</strong> — <code>0-9</code></li>
                      <li><strong>Information</strong> — <code>I</code></li>
                      <li><strong>Notes</strong> — <code>N</code></li>
                      <li><strong>Project Notes</strong> — <code>L</code></li>
                      <li><strong>Undo</strong> — <code>Ctrl+Z</code> / <code>Cmd+Z</code></li>
                    </ul>
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#222' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Arrow Keys</p>
                  <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>Switch Perspective</strong> — <code>←</code> / <code>→</code> (when not in Image Transform mode)</li>
                    <li>Use arrow keys to adjust image transformations (when transform tool is active)</li>
                    <li>Use arrow keys to nudge selected components</li>
                    <li>Click a slider first, then use arrow keys for precise adjustment</li>
                  </ul>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Tips & Tricks</h3>
                <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                  <li>Double-click any slider to reset it to the default value</li>
                  <li>Double-click a component to edit its properties</li>
                  <li>Hold <code>Shift</code> while clicking to add to selection</li>
                  <li>Use the Information dialog (<code>I</code>) to see details about selected elements</li>
                  <li>Lock layers (Tools → Lock) to prevent accidental modifications</li>
                  <li>Use the Find button in the Information dialog to center elements in view</li>
                  <li>Save views with <code>X</code> + number key for quick navigation</li>
                  <li>Use <code>+</code> and <code>-</code> keys to resize tool icons</li>
                </ul>
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px', lineHeight: '1.5' }}>
                  For more detailed feature information, see the <strong>About</strong> menu.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File path display */}
      {currentProjectFilePath && (
        <div style={{ 
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: '16px'
        }}>
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
          {/* Save status indicator - shows project save state */}
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '1px solid #666',
              backgroundColor: hasUnsavedChangesState 
                ? (autoSaveEnabled ? '#ffaa00' : '#ff0000') // Yellow if auto-save enabled, Red if disabled
                : '#00ff00', // Green if saved
              flexShrink: 0,
            }}
            title={
              hasUnsavedChangesState 
                ? (autoSaveEnabled 
                    ? `Changes detected • Auto Save: ON • Will be saved automatically every ${autoSaveInterval || 1} minute${autoSaveInterval === 1 ? '' : 's'}` 
                    : 'Changes detected • Auto Save: OFF • You need to save manually (File → Save Project)')
                : 'Project saved • No unsaved changes • Auto Save: ' + (autoSaveEnabled ? 'ON' : 'OFF')
            }
          />
        </div>
      )}
    </div>
      <SetToolSizeDialog
        visible={setToolSizeDialogVisible}
        toolRegistry={toolRegistry}
        currentTool={currentTool}
        drawingMode={drawingMode}
        traceToolLayer={traceToolLayer}
        padToolLayer={padToolLayer}
        testPointToolLayer={testPointToolLayer}
        componentToolLayer={componentToolLayer}
        updateToolSettings={updateToolSettings}
        updateToolLayerSettings={updateToolLayerSettings}
        setBrushSize={setBrushSize}
        saveToolSettings={saveToolSettings}
        saveToolLayerSettings={saveToolLayerSettings}
        setTopTraceSize={setTopTraceSize}
        setBottomTraceSize={setBottomTraceSize}
        setTopPadSize={setTopPadSize}
        setBottomPadSize={setBottomPadSize}
        setTopTestPointSize={setTopTestPointSize}
        setBottomTestPointSize={setBottomTestPointSize}
        setTopComponentSize={setTopComponentSize}
        setBottomComponentSize={setBottomComponentSize}
        setComponentConnectionSize={setComponentConnectionSize}
        saveDefaultSize={saveDefaultSize}
        onClose={() => setSetToolSizeDialogVisible(false)}
      />
      <SetToolColorDialog
        visible={setToolColorDialogVisible}
        toolRegistry={toolRegistry}
        currentTool={currentTool}
        drawingMode={drawingMode}
        traceToolLayer={traceToolLayer}
        padToolLayer={padToolLayer}
        testPointToolLayer={testPointToolLayer}
        componentToolLayer={componentToolLayer}
        updateToolSettings={updateToolSettings}
        updateToolLayerSettings={updateToolLayerSettings}
        saveToolSettings={saveToolSettings}
        saveToolLayerSettings={saveToolLayerSettings}
        setBrushColor={setBrushColor}
        setTopTraceColor={setTopTraceColor}
        setBottomTraceColor={setBottomTraceColor}
        setTopPadColor={setTopPadColor}
        setBottomPadColor={setBottomPadColor}
        setTopTestPointColor={setTopTestPointColor}
        setBottomTestPointColor={setBottomTestPointColor}
        setTopComponentColor={setTopComponentColor}
        setBottomComponentColor={setBottomComponentColor}
        setComponentConnectionColor={setComponentConnectionColor}
        saveDefaultColor={saveDefaultColor}
        colorPalette={colorPalette}
        onClose={() => setSetToolColorDialogVisible(false)}
      />
    </>
  );
};

