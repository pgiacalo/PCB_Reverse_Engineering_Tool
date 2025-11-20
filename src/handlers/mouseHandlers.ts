/**
 * Copyright 2025 Philip L. Giacalone
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Mouse event handlers for canvas interactions
 * 
 * Note: This module contains placeholder implementations.
 * The actual handlers from App.tsx should be moved here gradually during the refactoring process.
 * Due to the complexity and size of the mouse handlers (~2000+ lines), they will be extracted
 * incrementally to maintain functionality.
 */

import { useCallback } from 'react';
import type { PCBComponent } from '../types';
import type { DrawingStroke, DrawingPoint } from '../hooks/useDrawing';
import type { PowerSymbol, GroundSymbol, PowerBus } from '../hooks/usePowerGround';
import type { Layer, Tool } from '../hooks';
import { autoAssignPolarity } from '../utils/components';

export interface MouseHandlersProps {
  // Canvas and view
  canvasRef: React.RefObject<HTMLCanvasElement>;
  CONTENT_BORDER: number;
  viewPan: { x: number; y: number };
  viewScale: number;
  
  // Tool state
  currentTool: Tool;
  drawingMode: 'trace' | 'via' | 'pad';
  selectedDrawingLayer: Layer;
  
  // Drawing state
  isDrawing: boolean;
  currentStroke: DrawingPoint[];
  tracePreviewMousePos: { x: number; y: number } | null;
  isShiftConstrained: boolean;
  
  // Selection state
  isSelecting: boolean;
  selectStart: { x: number; y: number } | null;
  selectRect: { x: number; y: number; width: number; height: number } | null;
  selectedIds: Set<string>;
  selectedComponentIds: Set<string>;
  selectedPowerIds: Set<string>;
  selectedGroundIds: Set<string>;
  
  // Pan state
  isPanning: boolean;
  panStartRef: React.MutableRefObject<{ startCX: number; startCY: number; panX: number; panY: number } | null>;
  panClientStartRef: React.MutableRefObject<{ startClientX: number; startClientY: number; panX: number; panY: number } | null>;
  
  // Component state
  connectingPin: { componentId: string; pinIndex: number } | null;
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  selectedComponentType: any; // ComponentType
  componentToolLayer: Layer;
  traceToolLayer: Layer;
  
  // Drawing strokes
  drawingStrokes: DrawingStroke[];
  padToolLayer: Layer | null;
  
  // Power and ground
  powers: PowerSymbol[];
  grounds: GroundSymbol[];
  selectedPowerBusId: string | null;
  powerBuses: PowerBus[];
  
  // Layer visibility
  showViasLayer: boolean;
  showTopTracesLayer: boolean;
  showBottomTracesLayer: boolean;
  
  // Image transform
  selectedImageForTransform: 'top' | 'bottom' | 'both' | null;
  isTransforming: boolean;
  transformStartPos: { x: number; y: number } | null;
  topImage: any; // PCBImage | null
  bottomImage: any; // PCBImage | null
  
  // Settings
  toolRegistry: Map<string, any>;
  brushSize: number;
  brushColor: string;
  topPadColor: string;
  bottomPadColor: string;
  topPadSize: number;
  bottomPadSize: number;
  topComponentColor: string;
  bottomComponentColor: string;
  topComponentSize: number;
  bottomComponentSize: number;
  topTraceColor: string;
  bottomTraceColor: string;
  topTraceSize: number;
  bottomTraceSize: number;
  isSnapDisabled: boolean;
  
  // Locks
  areViasLocked: boolean;
  arePadsLocked: boolean;
  areTracesLocked: boolean;
  areImagesLocked: boolean;
  arePowerNodesLocked: boolean;
  areGroundNodesLocked: boolean;
  
  // Utility functions
  generatePointId: () => number;
  truncatePoint: (p: { x: number; y: number }) => { x: number; y: number };
  createComponent: (type: any, layer: Layer, x: number, y: number, color: string, size: number) => PCBComponent;
  getDefaultAbbreviation: (type: any) => string;
  determineViaType: (nodeId: number, powerBuses: PowerBus[]) => string;
  determinePadType: (nodeId: number, powerBuses: PowerBus[]) => string;
  snapConstrainedPoint: (start: DrawingPoint, x: number, y: number) => { x: number; y: number };
  alert: (message: string) => void;
  
  // State setters (many - will be grouped)
  setCurrentStroke: React.Dispatch<React.SetStateAction<DrawingPoint[]>>;
  setTracePreviewMousePos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsShiftConstrained: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSelecting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setSelectRect: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number } | null>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedComponentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedPowerIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedGroundIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  setViewPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setViewScale: React.Dispatch<React.SetStateAction<number>>;
  setConnectingPin: React.Dispatch<React.SetStateAction<{ componentId: string; pinIndex: number } | null>>;
  setComponentsTop: React.Dispatch<React.SetStateAction<PCBComponent[]>>;
  setComponentsBottom: React.Dispatch<React.SetStateAction<PCBComponent[]>>;
  setDrawingStrokes: React.Dispatch<React.SetStateAction<DrawingStroke[]>>;
  setPowerSymbols: React.Dispatch<React.SetStateAction<PowerSymbol[]>>;
  setGroundSymbols: React.Dispatch<React.SetStateAction<GroundSymbol[]>>;
  setIsTransforming: React.Dispatch<React.SetStateAction<boolean>>;
  setTransformStartPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setTopImage: React.Dispatch<React.SetStateAction<any>>;
  setBottomImage: React.Dispatch<React.SetStateAction<any>>;
  setErrorDialog: React.Dispatch<React.SetStateAction<{ visible: boolean; title: string; message: string }>>;
  // Additional setters for via order, etc.
  setViaOrderTop: React.Dispatch<React.SetStateAction<string[]>>;
  setViaOrderBottom: React.Dispatch<React.SetStateAction<string[]>>;
  setTraceOrderTop: React.Dispatch<React.SetStateAction<string[]>>;
  setTraceOrderBottom: React.Dispatch<React.SetStateAction<string[]>>;
  setShowTopComponents: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBottomComponents: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Refs for double-click detection, etc.
  isDoubleClickingTraceRef: React.MutableRefObject<boolean>;
  lastTraceClickTimeRef: React.MutableRefObject<number>;
  currentStrokeRef: React.MutableRefObject<DrawingPoint[]>;
  
  // Constants
  DEFAULT_VIA_COLOR: string;
  VIA_DEFAULT_SIZE: number;
}

export interface MouseHandlers {
  handleCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseUp: () => void;
}

/**
 * Creates mouse event handlers with all necessary dependencies
 * 
 * Note: The handlers are extracted from App.tsx and use the props interface
 * to access all necessary state and setters.
 */
export const createMouseHandlers = (props: MouseHandlersProps): MouseHandlers => {
  const {
    canvasRef,
    CONTENT_BORDER,
    viewPan,
    viewScale,
    currentTool,
    drawingMode,
    selectedDrawingLayer,
    isDrawing: _isDrawing,
    currentStroke: _currentStroke,
    tracePreviewMousePos: _tracePreviewMousePos,
    isShiftConstrained: _isShiftConstrained,
    isSelecting: _isSelecting,
    selectStart: _selectStart,
    selectRect: _selectRect,
    selectedIds: _selectedIds,
    selectedComponentIds: _selectedComponentIds,
    selectedPowerIds: _selectedPowerIds,
    selectedGroundIds: _selectedGroundIds,
    isPanning: _isPanning,
    panStartRef,
    panClientStartRef,
    connectingPin,
    componentsTop,
    componentsBottom,
    selectedComponentType,
    componentToolLayer,
    traceToolLayer,
    drawingStrokes,
    padToolLayer,
    powers,
    grounds,
    selectedPowerBusId,
    powerBuses,
    showViasLayer,
    showTopTracesLayer: _showTopTracesLayer,
    showBottomTracesLayer: _showBottomTracesLayer,
    selectedImageForTransform,
    toolRegistry,
    brushSize,
    brushColor: _brushColor,
    topPadColor,
    bottomPadColor,
    topPadSize,
    bottomPadSize,
    topComponentColor,
    bottomComponentColor,
    topComponentSize,
    bottomComponentSize,
    topTraceColor: _topTraceColor,
    bottomTraceColor: _bottomTraceColor,
    topTraceSize: _topTraceSize,
    bottomTraceSize: _bottomTraceSize,
    isSnapDisabled,
    areViasLocked,
    arePadsLocked,
    areTracesLocked,
    areImagesLocked,
    generatePointId,
    truncatePoint,
    createComponent,
    getDefaultAbbreviation,
    determineViaType,
    determinePadType,
    snapConstrainedPoint: _snapConstrainedPoint,
    alert,
    setCurrentStroke,
    setTracePreviewMousePos,
    setIsDrawing,
    setIsShiftConstrained,
    setIsSelecting,
    setSelectStart,
    setSelectRect,
    setSelectedIds,
    setSelectedComponentIds,
    setSelectedPowerIds,
    setSelectedGroundIds,
    setIsPanning,
    setViewPan,
    setViewScale,
    setConnectingPin,
    setComponentsTop,
    setComponentsBottom,
    setDrawingStrokes,
    setPowerSymbols,
    setGroundSymbols,
    setIsTransforming,
    setTransformStartPos,
    setErrorDialog,
    setViaOrderTop,
    setViaOrderBottom,
    setTraceOrderTop: _setTraceOrderTop,
    setTraceOrderBottom: _setTraceOrderBottom,
    setShowTopComponents,
    setShowBottomComponents,
    isDoubleClickingTraceRef,
    lastTraceClickTimeRef,
    currentStrokeRef: _currentStrokeRef,
    DEFAULT_VIA_COLOR: defaultViaColor,
    VIA_DEFAULT_SIZE: viaDefaultSize,
  } = props;

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
              
              // Auto-assign polarity for 2-pin components with polarity
              const newPolarities = comp ? autoAssignPolarity(comp, newPinConnections, drawingStrokes as any) : null;
              
              const updated = prev.map(c => {
                if (c.id === componentId) {
                  const updatedComp = { ...c, pinConnections: newPinConnections };
                  if (newPolarities) {
                    (updatedComp as any).pinPolarities = newPolarities;
                  }
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
              
              // Auto-assign polarity for 2-pin components with polarity
              const newPolarities = comp ? autoAssignPolarity(comp, newPinConnections, drawingStrokes as any) : null;
              
              const updated = prev.map(c => {
                if (c.id === componentId) {
                  const updatedComp = { ...c, pinConnections: newPinConnections };
                  if (newPolarities) {
                    (updatedComp as any).pinPolarities = newPolarities;
                  }
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
        const viaColor = savedColor || viaDef?.settings.color || defaultViaColor;
        const viaSize = savedSize ? parseInt(savedSize, 10) : (viaDef?.settings.size || viaDefaultSize);
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
        : { x: snapped.x, y: snapped.y } as DrawingPoint;
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
      return;
    }
  }, [
    canvasRef,
    CONTENT_BORDER,
    viewPan,
    viewScale,
    currentTool,
    drawingMode,
    selectedDrawingLayer,
    connectingPin,
    componentsTop,
    componentsBottom,
    drawingStrokes,
    powers,
    grounds,
    selectedPowerBusId,
    powerBuses,
    selectedComponentType,
    toolRegistry,
    padToolLayer,
    traceToolLayer,
    componentToolLayer,
    brushSize,
    topPadColor,
    bottomPadColor,
    topPadSize,
    bottomPadSize,
    topComponentColor,
    bottomComponentColor,
    topComponentSize,
    bottomComponentSize,
    isSnapDisabled,
    areViasLocked,
    arePadsLocked,
    areTracesLocked,
    areImagesLocked,
    selectedImageForTransform,
    showViasLayer,
    generatePointId,
    truncatePoint,
    createComponent,
    getDefaultAbbreviation,
    determineViaType,
    determinePadType,
    setCurrentStroke,
    setDrawingStrokes,
    setIsDrawing,
    setIsShiftConstrained,
    setTracePreviewMousePos,
    setSelectedIds,
    setSelectedComponentIds,
    setSelectedPowerIds,
    setSelectedGroundIds,
    setIsSelecting,
    setSelectStart,
    setSelectRect,
    setViewScale,
    setViewPan,
    setIsPanning,
    setConnectingPin,
    setComponentsTop,
    setComponentsBottom,
    setPowerSymbols,
    setGroundSymbols,
    setIsTransforming,
    setTransformStartPos,
    setErrorDialog,
    setViaOrderTop,
    setViaOrderBottom,
    setShowTopComponents,
    setShowBottomComponents,
    isDoubleClickingTraceRef,
    lastTraceClickTimeRef,
    panStartRef,
    panClientStartRef,
    defaultViaColor,
    viaDefaultSize,
  ]);

  const handleCanvasMouseMove = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    console.warn('handleCanvasMouseMove not yet implemented in handlers module');
    // TODO: Extract actual implementation from App.tsx (lines ~2014-2290)
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    console.warn('handleCanvasMouseUp not yet implemented in handlers module');
    // TODO: Extract actual implementation from App.tsx (lines ~2291-2538)
  }, []);

  return {
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  };
};
