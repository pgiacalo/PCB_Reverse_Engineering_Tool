import React from 'react';
import type { Tool } from '../../hooks/useToolRegistry';
import type { PCBImage } from '../../hooks/useImage';
import type { DrawingStroke } from '../../hooks/useDrawing';
import type { PCBComponent } from '../../types';

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
  onExportSchematic: () => Promise<void>;
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
  
  // Power bus
  setShowPowerBusManager: (show: boolean) => void;
  
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
  onExportSchematic,
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
  setShowPowerBusManager,
  menuBarRef,
}) => {
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
            <button
              onClick={() => {
                if (!isReadOnlyMode) {
                  void onExportSchematic(); 
                  setOpenMenu(null); 
                }
              }} 
              disabled={isReadOnlyMode}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
            >
              Export Simple Schematic…
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
            <button onClick={() => { onEnterBoardDimensions(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Enter Dimensions…</button>
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
                setSetSizeDialog({ visible: true, size: getCurrentSize() });
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
            <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>Select All</div>
            <button onClick={() => { selectAllVias(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select All Vias
            </button>
            <button onClick={() => { selectAllTraces(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select All Traces
            </button>
            <button onClick={() => { selectAllPads(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select All Pads
            </button>
            <button onClick={() => { selectAllComponents(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select All Components
            </button>
            <button onClick={() => { selectDisconnectedComponents(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select Disconnected
            </button>
            <button onClick={() => { selectAllPowerNodes(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select All Power Nodes
            </button>
            <button onClick={() => { selectAllGroundNodes(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Select All Ground Nodes
            </button>
            <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
            <button onClick={() => { setShowPowerBusManager(true); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
              Manage Power Buses…
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
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 400, maxWidth: 600, maxHeight: '80vh', background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 16, overflowY: 'auto', zIndex: 100 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 12px 0', color: '#000', fontSize: '18px', fontWeight: 700 }}>PCB Reverse Engineering Tool</h2>
              <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                A specialized tool for reverse engineering printed circuit boards (PCBs) by tracing and documenting circuit connections from PCB images.
              </p>
              <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                This application supports typical 4-layer PCBs and allows you to load top and bottom PCB images, trace connections, place components, and export schematics in KiCad format.
              </p>
              <p style={{ margin: '0 0 12px 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                <strong>Key Features:</strong>
              </p>
              <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                <li>Load and align top and bottom PCB images</li>
                <li>Trace connections with automatic node snapping</li>
                <li>Place and annotate components with pin connections</li>
                <li>Manage power buses and ground connections</li>
                <li>Export to KiCad schematic format</li>
                <li>Auto-save functionality for project management</li>
              </ul>
              <p style={{ margin: '0 0 0 0', color: '#222', fontSize: '14px', lineHeight: '1.6' }}>
                Use the <strong>File</strong> menu to create new projects, save your work, and export schematics. The <strong>Images</strong> menu provides tools for aligning and transforming PCB images. The <strong>Tools</strong> menu offers size adjustments and locking controls for different PCB elements.
              </p>
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
  );
};

