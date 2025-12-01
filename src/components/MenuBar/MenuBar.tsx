import React from 'react';
import type { Tool, ToolDefinition, ToolSettings } from '../../hooks/useToolRegistry';
import type { PCBImage } from '../../hooks/useImage';
import type { DrawingStroke } from '../../hooks/useDrawing';
import type { PCBComponent } from '../../types';
import { SetToolSizeDialog } from '../SetToolSizeDialog';
import { SetToolColorDialog } from '../SetToolColorDialog';

export interface MenuBarProps {
  // Menu state
  openMenu: 'file' | 'transform' | 'tools' | 'about' | null;
  setOpenMenu: React.Dispatch<React.SetStateAction<'file' | 'transform' | 'tools' | 'about' | null>>;
  
  // Read-only mode
  isReadOnlyMode: boolean;
  currentProjectFilePath: string;
  
  // File operations
  onNewProject: () => void;
  onOpenProject: () => Promise<void>;
  onSaveProject: () => Promise<void>;
  onSaveAs: () => void;
  onPrint: () => void;
  hasUnsavedChanges: () => boolean;
  
  // Dialogs
  setNewProjectDialog: (dialog: { visible: boolean }) => void;
  setAutoSaveDialog: (dialog: { visible: boolean; interval: number | null }) => void;
  
  // Image operations
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  selectedImageForTransform: 'top' | 'bottom' | 'both' | null;
  setSelectedImageForTransform: (image: 'top' | 'bottom' | 'both' | null) => void;
  setCurrentTool: (tool: Tool) => void;
  transformMode: 'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone';
  setTransformMode: (mode: 'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone') => void;
  updateImageTransform: (type: 'top' | 'bottom' | 'both', updates: Partial<PCBImage>) => void;
  resetImageTransform: () => void;
  isGrayscale: boolean;
  setIsGrayscale: React.Dispatch<React.SetStateAction<boolean>>;
  isBlackAndWhiteEdges: boolean;
  setIsBlackAndWhiteEdges: React.Dispatch<React.SetStateAction<boolean>>;
  isBlackAndWhiteInverted: boolean;
  setIsBlackAndWhiteInverted: React.Dispatch<React.SetStateAction<boolean>>;
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
  areTracesLocked: boolean;
  setAreTracesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  areComponentsLocked: boolean;
  setAreComponentsLocked: React.Dispatch<React.SetStateAction<boolean>>;
  areGroundNodesLocked: boolean;
  setAreGroundNodesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  arePowerNodesLocked: boolean;
  setArePowerNodesLocked: React.Dispatch<React.SetStateAction<boolean>>;
  
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
  drawingMode: 'trace' | 'via' | 'pad';
  traceToolLayer: 'top' | 'bottom';
  padToolLayer: 'top' | 'bottom';
  componentToolLayer: 'top' | 'bottom';
  
  // Layer-specific size setters
  setTopTraceSize: (size: number) => void;
  setBottomTraceSize: (size: number) => void;
  setTopPadSize: (size: number) => void;
  setBottomPadSize: (size: number) => void;
  setTopComponentSize: (size: number) => void;
  setBottomComponentSize: (size: number) => void;
  
  // Layer-specific color getters (to get current color when updating size)
  topTraceColor: string;
  bottomTraceColor: string;
  topPadColor: string;
  bottomPadColor: string;
  topComponentColor: string;
  bottomComponentColor: string;
  
  // Layer-specific color setters
  setTopTraceColor: (color: string) => void;
  setBottomTraceColor: (color: string) => void;
  setTopPadColor: (color: string) => void;
  setBottomPadColor: (color: string) => void;
  setTopComponentColor: (color: string) => void;
  setBottomComponentColor: (color: string) => void;
  
  // Legacy save functions (used by +/- keys)
  saveDefaultSize: (toolType: 'via' | 'pad' | 'trace' | 'component' | 'power' | 'ground' | 'brush', size: number, layer?: 'top' | 'bottom') => void;
  saveDefaultColor: (type: 'via' | 'pad' | 'trace' | 'component' | 'brush', color: string, layer?: 'top' | 'bottom') => void;
  
  // Menu bar ref
  menuBarRef: React.RefObject<HTMLDivElement | null>;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  openMenu,
  setOpenMenu,
  isReadOnlyMode,
  currentProjectFilePath,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveAs,
  onPrint,
  hasUnsavedChanges,
  setNewProjectDialog,
  setAutoSaveDialog,
  topImage,
  bottomImage,
  selectedImageForTransform,
  setSelectedImageForTransform,
  setCurrentTool,
  transformMode,
  setTransformMode,
  updateImageTransform,
  resetImageTransform,
  isGrayscale,
  setIsGrayscale,
  isBlackAndWhiteEdges,
  setIsBlackAndWhiteEdges,
  isBlackAndWhiteInverted: _isBlackAndWhiteInverted,
  setIsBlackAndWhiteInverted,
  areImagesLocked,
  setAreImagesLocked,
  onEnterBoardDimensions,
  fileInputTopRef,
  fileInputBottomRef,
  openProjectRef: _openProjectRef,
  increaseSize,
  decreaseSize,
  brushSize,
  drawingStrokes,
  selectedIds,
  selectedComponentIds,
  selectedPowerIds,
  selectedGroundIds,
  componentsTop,
  componentsBottom,
  powers,
  grounds,
  powerNodeNames,
  groundNodeNames,
  setSetSizeDialog,
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
  setSelectedIds: _setSelectedIds,
  setSelectedComponentIds: _setSelectedComponentIds,
  setSelectedPowerIds: _setSelectedPowerIds,
  setSelectedGroundIds: _setSelectedGroundIds,
  selectAllVias,
  selectAllTraces,
  selectAllPads,
  selectAllComponents,
  selectDisconnectedComponents,
  selectAllPowerNodes,
  selectAllGroundNodes,
  selectPowerNodesByName,
  selectGroundNodesByName,
  setShowPowerBusManager,
  setShowGroundBusManager,
  setShowDesignatorManager,
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
  componentToolLayer,
  setTopTraceSize,
  setBottomTraceSize,
  setTopPadSize,
  setBottomPadSize,
  setTopComponentSize,
  setBottomComponentSize,
  topTraceColor,
  bottomTraceColor,
  topPadColor,
  bottomPadColor,
  topComponentColor,
  bottomComponentColor,
  setTopTraceColor,
  setBottomTraceColor,
  setTopPadColor,
  setBottomPadColor,
  setTopComponentColor,
  setBottomComponentColor,
  saveDefaultSize,
  saveDefaultColor,
  menuBarRef,
}) => {
  // Track which image submenu is open
  const [openImageSubmenu, setOpenImageSubmenu] = React.useState<'top' | 'bottom' | 'both' | null>(null);
  const submenuTimeoutRef = React.useRef<number | null>(null);

  // Track which node selection submenu is open (power or ground)
  const [openSelectNodesSubmenu, setOpenSelectNodesSubmenu] = React.useState<'power' | 'ground' | null>(null);
  const selectSubmenuTimeoutRef = React.useRef<number | null>(null);

  // Track which Tools submenu is open (Lock or Select)
  const [openToolsSubmenu, setOpenToolsSubmenu] = React.useState<'lock' | 'select' | null>(null);
  const toolsSubmenuTimeoutRef = React.useRef<number | null>(null);
  
  // Dialog visibility state
  const [setToolSizeDialogVisible, setSetToolSizeDialogVisible] = React.useState(false);
  const [setToolColorDialogVisible, setSetToolColorDialogVisible] = React.useState(false);

  // Helper function to render image submenu items
  const renderImageSubmenu = (imageType: 'top' | 'bottom' | 'both', submenuTimeoutRef: React.MutableRefObject<number | null>) => {
    const isTop = imageType === 'top';
    const isBottom = imageType === 'bottom';
    const isBoth = imageType === 'both';
    const image = isTop ? topImage : (isBottom ? bottomImage : null);
    const hasImage = isBoth ? (topImage && bottomImage) : (image !== null);
    const isDisabled = !hasImage || areImagesLocked;

    return (
      <div 
        onMouseEnter={() => {
          // Clear any pending timeout when mouse enters submenu
          if (submenuTimeoutRef.current) {
            clearTimeout(submenuTimeoutRef.current);
            submenuTimeoutRef.current = null;
          }
          setOpenImageSubmenu(imageType);
        }}
        onMouseLeave={() => {
          // Close submenu when mouse leaves
          setOpenImageSubmenu(null);
        }}
        style={{ position: 'absolute', top: 0, left: '100%', marginLeft: '4px', minWidth: 260, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6, zIndex: 10 }}
      >
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click the flip button.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            const targetImageType = (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') 
              ? selectedImageForTransform 
              : imageType;
            
            if (targetImageType === 'both') {
              const newFlipX = !(topImage?.flipX || false);
              updateImageTransform('both', { flipX: newFlipX });
            } else {
              const currentFlipX = targetImageType === 'top' ? (topImage?.flipX || false) : (bottomImage?.flipX || false);
              updateImageTransform(targetImageType, { flipX: !currentFlipX });
            }
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          Horizontal Flip
        </button>
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click the flip button.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            const targetImageType = (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') 
              ? selectedImageForTransform 
              : imageType;
            
            if (targetImageType === 'both') {
              const newFlipY = !(topImage?.flipY || false);
              updateImageTransform('both', { flipY: newFlipY });
            } else {
              const currentFlipY = targetImageType === 'top' ? (topImage?.flipY || false) : (bottomImage?.flipY || false);
              updateImageTransform(targetImageType, { flipY: !currentFlipY });
            }
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          Vertical Flip
        </button>
        <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click "Mode: Nudge", which would
            // cause the submenu's imageType to change to 'both'.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            if (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') {
              // Preserve the existing selection (top or bottom)
              // Don't change it even if the submenu has switched to 'both'
            } else {
              // Use the submenu's imageType (for initial selection or 'both' case)
              setSelectedImageForTransform(imageType);
            }
            setTransformMode('nudge');
            setCurrentTool('transform');
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {transformMode === 'nudge' && selectedImageForTransform === imageType ? '✓ ' : ''}Mode: Nudge
        </button>
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click "Mode: Scale", which would
            // cause the submenu's imageType to change to 'both'.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            if (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') {
              // Preserve the existing selection (top or bottom)
              // Don't change it even if the submenu has switched to 'both'
            } else {
              // Use the submenu's imageType (for initial selection or 'both' case)
              setSelectedImageForTransform(imageType);
            }
            setTransformMode('scale');
            setCurrentTool('transform');
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {transformMode === 'scale' && selectedImageForTransform === imageType ? '✓ ' : ''}Mode: Scale
        </button>
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click "Mode: Rotate", which would
            // cause the submenu's imageType to change to 'both'.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            if (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') {
              // Preserve the existing selection (top or bottom)
              // Don't change it even if the submenu has switched to 'both'
            } else {
              // Use the submenu's imageType (for initial selection or 'both' case)
              setSelectedImageForTransform(imageType);
            }
            setTransformMode('rotate');
            setCurrentTool('transform');
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {transformMode === 'rotate' && selectedImageForTransform === imageType ? '✓ ' : ''}Mode: Rotate
        </button>
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click "Mode: Slant", which would
            // cause the submenu's imageType to change to 'both'.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            if (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') {
              // Preserve the existing selection (top or bottom)
              // Don't change it even if the submenu has switched to 'both'
            } else {
              // Use the submenu's imageType (for initial selection or 'both' case)
              setSelectedImageForTransform(imageType);
            }
            setTransformMode('slant');
            setCurrentTool('transform');
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {transformMode === 'slant' && selectedImageForTransform === imageType ? '✓ ' : ''}Mode: Slant
        </button>
        <button 
          onClick={() => { 
            // Preserve the currently selected image if it's already set to 'top' or 'bottom'.
            // This prevents the selection from changing to 'both' if the mouse accidentally
            // passes over "Both Images" while moving to click "Mode: Keystone", which would
            // cause the submenu's imageType to change to 'both'.
            // Only use the submenu's imageType if selectedImageForTransform is null or 'both'.
            if (selectedImageForTransform === 'top' || selectedImageForTransform === 'bottom') {
              // Preserve the existing selection (top or bottom)
              // Don't change it even if the submenu has switched to 'both'
            } else {
              // Use the submenu's imageType (for initial selection or 'both' case)
              setSelectedImageForTransform(imageType);
            }
            setTransformMode('keystone');
            setCurrentTool('transform');
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {transformMode === 'keystone' && selectedImageForTransform === imageType ? '✓ ' : ''}Mode: Keystone
        </button>
        <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
        <button 
          onClick={() => {
            setSelectedImageForTransform(imageType);
            setCurrentTool('transform');
            if (isGrayscale || isBlackAndWhiteEdges) {
              setIsGrayscale(false);
              setIsBlackAndWhiteEdges(false);
              setIsBlackAndWhiteInverted(false);
            } else {
              setIsGrayscale(true);
            }
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {(isGrayscale || isBlackAndWhiteEdges) ? 'Color Mode' : 'Grayscale Mode'}
        </button>
        <button 
          onClick={() => {
            setSelectedImageForTransform(imageType);
            setCurrentTool('transform');
            if (!isBlackAndWhiteEdges) {
              setIsBlackAndWhiteEdges(true);
              setIsBlackAndWhiteInverted(false);
            } else {
              setIsBlackAndWhiteInverted(prev => !prev);
            }
            setOpenImageSubmenu(null);
            setOpenMenu(null);
          }} 
          disabled={isDisabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isDisabled ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          {isBlackAndWhiteEdges ? 'Invert Edges' : 'Black & White Edges'}
        </button>
      </div>
    );
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
        <button onClick={() => { selectAllComponents(); setOpenToolsSubmenu(null); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
          All Components
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

  // Determine current size for Set Size dialog
  const getCurrentSize = (): number => {
    if (selectedIds.size > 0) {
      const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
      if (selectedStrokes.length > 0) {
        return selectedStrokes[0].size;
      }
    } else if (selectedComponentIds.size > 0) {
      const selectedComp = [...componentsTop, ...componentsBottom].find(c => selectedComponentIds.has(c.id));
      if (selectedComp) {
        return selectedComp.size || 18;
      }
    } else if (selectedPowerIds.size > 0) {
      const selectedPower = powers.find(p => selectedPowerIds.has(p.id));
      if (selectedPower) {
        return selectedPower.size;
      }
    } else if (selectedGroundIds.size > 0) {
      const selectedGround = grounds.find(g => selectedGroundIds.has(g.id));
      if (selectedGround) {
        return selectedGround.size || 18;
      }
    }
    return brushSize;
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
              onClick={() => { if (!isReadOnlyMode) { void onSaveProject(); setOpenMenu(null); } }} 
              disabled={isReadOnlyMode}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
            >
              Save Project…
            </button>
            <button 
              onClick={() => { if (!isReadOnlyMode) { onSaveAs(); setOpenMenu(null); } }} 
              disabled={isReadOnlyMode}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
            >
              Save As…
            </button>
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) { 
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
            <button onClick={() => { onPrint(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Print…</button>
            <button onClick={() => { onPrint(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Printer Settings…</button>
          </div>
        )}
      </div>

      {/* Images menu - simplified for now, full implementation would include all transform options */}
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
            <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>Select Image</div>
            <div style={{ position: 'relative' }}>
              <button 
                disabled={!topImage || areImagesLocked} 
                onMouseEnter={() => {
                  if (!areImagesLocked) {
                    if (submenuTimeoutRef.current) {
                      clearTimeout(submenuTimeoutRef.current);
                      submenuTimeoutRef.current = null;
                    }
                    setOpenImageSubmenu('top');
                  }
                }}
                onMouseLeave={() => {
                  // Delay to allow moving to submenu (increased delay for better UX)
                  submenuTimeoutRef.current = setTimeout(() => {
                    setOpenImageSubmenu(prev => prev === 'top' ? null : prev);
                  }, 300);
                }}
                onClick={() => { 
                  if (!areImagesLocked) {
                    setSelectedImageForTransform('top'); 
                    setCurrentTool('transform');
                  }
                }} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (!topImage || areImagesLocked) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (!topImage || areImagesLocked) ? 'not-allowed' : 'pointer' }}
              >
                {selectedImageForTransform === 'top' ? '✓ ' : ''}Top Image ▸
              </button>
              {openImageSubmenu === 'top' && !areImagesLocked && renderImageSubmenu('top', submenuTimeoutRef)}
            </div>
            <div style={{ position: 'relative' }}>
              <button 
                disabled={!bottomImage || areImagesLocked} 
                onMouseEnter={() => {
                  if (!areImagesLocked) {
                    if (submenuTimeoutRef.current) {
                      clearTimeout(submenuTimeoutRef.current);
                      submenuTimeoutRef.current = null;
                    }
                    setOpenImageSubmenu('bottom');
                  }
                }}
                onMouseLeave={() => {
                  // Delay to allow moving to submenu (increased delay for better UX)
                  submenuTimeoutRef.current = setTimeout(() => {
                    setOpenImageSubmenu(prev => prev === 'bottom' ? null : prev);
                  }, 300);
                }}
                onClick={() => { 
                  if (!areImagesLocked) {
                    setSelectedImageForTransform('bottom'); 
                    setCurrentTool('transform');
                  }
                }} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (!bottomImage || areImagesLocked) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: (!bottomImage || areImagesLocked) ? 'not-allowed' : 'pointer' }}
              >
                {selectedImageForTransform === 'bottom' ? '✓ ' : ''}Bottom Image ▸
              </button>
              {openImageSubmenu === 'bottom' && !areImagesLocked && renderImageSubmenu('bottom', submenuTimeoutRef)}
            </div>
            <div style={{ position: 'relative' }}>
              <button 
                disabled={(!topImage || !bottomImage) || areImagesLocked} 
                onMouseEnter={() => {
                  if (!areImagesLocked) {
                    if (submenuTimeoutRef.current) {
                      clearTimeout(submenuTimeoutRef.current);
                      submenuTimeoutRef.current = null;
                    }
                    setOpenImageSubmenu('both');
                  }
                }}
                onMouseLeave={() => {
                  // Delay to allow moving to submenu (increased delay for better UX)
                  submenuTimeoutRef.current = setTimeout(() => {
                    setOpenImageSubmenu(prev => prev === 'both' ? null : prev);
                  }, 300);
                }}
                onClick={() => { 
                  if (!areImagesLocked) {
                    setSelectedImageForTransform('both'); 
                    setCurrentTool('transform');
                  }
                }} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: ((!topImage || !bottomImage) || areImagesLocked) ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: ((!topImage || !bottomImage) || areImagesLocked) ? 'not-allowed' : 'pointer' }}
              >
                {selectedImageForTransform === 'both' ? '✓ ' : ''}Both Images ▸
              </button>
              {openImageSubmenu === 'both' && !areImagesLocked && renderImageSubmenu('both', submenuTimeoutRef)}
            </div>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button 
              onClick={() => { if (!areImagesLocked) { setCurrentTool('transform'); resetImageTransform(); setOpenMenu(null); } }} 
              disabled={areImagesLocked}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: areImagesLocked ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: areImagesLocked ? 'not-allowed' : 'pointer' }}
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
                setSetToolSizeDialogVisible(true);
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
              Set Tool Size…
            </button>
            <button
              onClick={() => {
                setSetToolColorDialogVisible(true);
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
              Set Tool Color…
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
              <h2 style={{ margin: '0 0 16px 0', color: '#000', fontSize: '20px', fontWeight: 700 }}>PCB Reverse Engineering Tool</h2>
              
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>About</h3>
                <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  A specialized tool for reverse engineering printed circuit boards (PCBs) by tracing and documenting circuit connections from PCB images. This application supports typical 4-layer PCBs and enables comprehensive PCB analysis and documentation.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Technology</h3>
                <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                  The PCB Reverse Engineering Tool is a modern browser-based single-page application (SPA) that enables users to reverse engineer printed circuit boards by tracing connections and placing components. The application runs entirely client-side in the browser, leveraging modern web technologies to provide a responsive, interactive drawing experience with no backend server requirements.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 600 }}>Features</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Image Management</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Load top and bottom PCB images</li>
                      <li>Image alignment and transformation</li>
                      <li>Transform modes: nudge, scale, rotate, slant, keystone</li>
                      <li>Horizontal and vertical flip controls</li>
                      <li>Grayscale and edge detection modes</li>
                      <li>Board dimensions configuration</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Drawing Tools</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Draw copper traces (top and bottom layers)</li>
                      <li>Place vias for layer connections</li>
                      <li>Place component pads (SMD and through-hole)</li>
                      <li>Place and annotate components</li>
                      <li>Place power and ground nodes</li>
                      <li>Erase tool for removing elements</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>Layer Management</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
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
                      <li>Project file format (JSON)</li>
                      <li>Print functionality</li>
                      <li>Export to KiCad schematic format</li>
                    </ul>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#222', fontSize: '14px', fontWeight: 600 }}>View Controls</p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '13px', lineHeight: '1.6' }}>
                      <li>Zoom in/out with mouse wheel</li>
                      <li>Pan view with hand tool</li>
                      <li>Zoom to fit</li>
                      <li>View mode switching (top/bottom/overlay)</li>
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
        setTopComponentSize={setTopComponentSize}
        setBottomComponentSize={setBottomComponentSize}
        topTraceColor={topTraceColor}
        bottomTraceColor={bottomTraceColor}
        topPadColor={topPadColor}
        bottomPadColor={bottomPadColor}
        topComponentColor={topComponentColor}
        bottomComponentColor={bottomComponentColor}
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
        setTopComponentColor={setTopComponentColor}
        setBottomComponentColor={setBottomComponentColor}
        saveDefaultColor={saveDefaultColor}
        colorPalette={colorPalette}
        topTraceColor={topTraceColor}
        bottomTraceColor={bottomTraceColor}
        topPadColor={topPadColor}
        bottomPadColor={bottomPadColor}
        topComponentColor={topComponentColor}
        bottomComponentColor={bottomComponentColor}
        onClose={() => setSetToolColorDialogVisible(false)}
      />
    </>
  );
};

