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
 * NotesDialog component
 * Displays and allows editing of notes for selected PCB elements (components, vias, pads, traces, power, ground)
 */

import React, { useState, useRef, useEffect } from 'react';
import type { PCBComponent } from '../../types';
import type { PowerSymbol, GroundSymbol, PowerBus } from '../../hooks/usePowerGround';
import { formatComponentTypeName } from '../../constants';

// DrawingStroke type matches App.tsx's local interface
interface DrawingStroke {
  id: string;
  points: Array<{ x: number; y: number; id?: number }>;
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via' | 'pad' | 'testPoint';
  notes?: string | null;
  viaType?: string;
  padType?: string;
  testPointType?: 'power' | 'ground' | 'signal' | 'unknown';
}

export interface NotesDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Selected drawing stroke IDs */
  selectedIds: Set<string>;
  /** Selected component IDs */
  selectedComponentIds: Set<string>;
  /** Selected power node IDs */
  selectedPowerIds: Set<string>;
  /** Selected ground node IDs */
  selectedGroundIds: Set<string>;
  /** Drawing strokes */
  drawingStrokes: DrawingStroke[];
  /** Top layer components */
  componentsTop: PCBComponent[];
  /** Bottom layer components */
  componentsBottom: PCBComponent[];
  /** Power symbols */
  powers: PowerSymbol[];
  /** Ground symbols */
  grounds: GroundSymbol[];
  /** Power buses */
  powerBuses: PowerBus[];
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback to update top components */
  setComponentsTop: React.Dispatch<React.SetStateAction<PCBComponent[]>>;
  /** Callback to update bottom components */
  setComponentsBottom: React.Dispatch<React.SetStateAction<PCBComponent[]>>;
  /** Callback to update drawing strokes */
  setDrawingStrokes: React.Dispatch<React.SetStateAction<DrawingStroke[]>>;
  /** Callback to update power symbols */
  setPowerSymbols: React.Dispatch<React.SetStateAction<PowerSymbol[]>>;
  /** Callback to update ground symbols */
  setGroundSymbols: React.Dispatch<React.SetStateAction<GroundSymbol[]>>;
  /** Utility function to determine via type */
  determineViaType: (nodeId: number, powerBuses: PowerBus[]) => string;
  /** Utility function to determine pad type */
  determinePadType: (nodeId: number, powerBuses: PowerBus[]) => string;
  /** Utility function to determine test point type */
  determineTestPointType: (nodeId: number, powerBuses: PowerBus[]) => string;
  /** Dialog position for dragging */
  position: { x: number; y: number } | null;
  /** Whether the dialog is being dragged */
  isDragging: boolean;
  /** Callback when drag starts */
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const MAX_NOTES_LENGTH = 200;

export const NotesDialog: React.FC<NotesDialogProps> = ({
  visible,
  selectedIds,
  selectedComponentIds,
  selectedPowerIds,
  selectedGroundIds,
  drawingStrokes,
  componentsTop,
  componentsBottom,
  powers,
  grounds,
  powerBuses,
  onClose,
  setComponentsTop,
  setComponentsBottom,
  setDrawingStrokes,
  setPowerSymbols,
  setGroundSymbols,
  determineViaType,
  determinePadType,
  determineTestPointType,
  position,
  isDragging,
  onDragStart,
}) => {
  // Local state for notes editing - preserve user edits even when selection changes
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const lastSelectionKeyRef = useRef<string>('');

  // Compute current selection key to detect selection changes
  const getSelectionKey = () => {
    const ids = [
      ...Array.from(selectedIds).sort(),
      ...Array.from(selectedComponentIds).sort(),
      ...Array.from(selectedPowerIds).sort(),
      ...Array.from(selectedGroundIds).sort(),
    ].join(',');
    return ids;
  };

  // Update notesMap when selection changes (but preserve existing edits)
  useEffect(() => {
    if (!visible) return;

    const currentSelectionKey = getSelectionKey();
    
    // Only update if selection actually changed
    if (currentSelectionKey === lastSelectionKeyRef.current) {
      return;
    }

    lastSelectionKeyRef.current = currentSelectionKey;

    // Build new map, preserving existing edits for objects still selected
    setNotesMap(prevNotesMap => {
      const newNotesMap = new Map<string, string>();

      // Components
      [...componentsTop, ...componentsBottom]
        .filter(c => selectedComponentIds.has(c.id))
        .forEach(comp => {
          // Preserve existing edit if available, otherwise use current notes
          const existingEdit = prevNotesMap.get(comp.id);
          newNotesMap.set(comp.id, existingEdit !== undefined ? existingEdit : (comp.notes || ''));
        });

      // Drawing strokes
      drawingStrokes
        .filter(s => selectedIds.has(s.id))
        .forEach(stroke => {
          const existingEdit = prevNotesMap.get(stroke.id);
          newNotesMap.set(stroke.id, existingEdit !== undefined ? existingEdit : (stroke.notes || ''));
        });

      // Power symbols
      powers
        .filter(p => selectedPowerIds.has(p.id))
        .forEach(power => {
          const existingEdit = prevNotesMap.get(power.id);
          newNotesMap.set(power.id, existingEdit !== undefined ? existingEdit : (power.notes || ''));
        });

      // Ground symbols
      grounds
        .filter(g => selectedGroundIds.has(g.id))
        .forEach(ground => {
          const existingEdit = prevNotesMap.get(ground.id);
          newNotesMap.set(ground.id, existingEdit !== undefined ? existingEdit : (ground.notes || ''));
        });

      return newNotesMap;
    });
  }, [visible, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds]);

  if (!visible) return null;

  // Use provided position or default to right side
  const dialogStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: '#fff',
        borderRadius: 8,
        minWidth: '150px',
        maxWidth: '400px',
        width: 'fit-content',
        maxHeight: '80%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        border: '1px solid #ddd',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : 'default',
      }
    : {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        paddingRight: '20px',
        paddingTop: '80px',
        zIndex: 10000,
        pointerEvents: 'none',
      };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  };

  // Calculate total selected objects
  const strokeCount = drawingStrokes.filter(s => selectedIds.has(s.id)).length;
  const componentCount = [...componentsTop, ...componentsBottom].filter(c => selectedComponentIds.has(c.id)).length;
  const powerCount = powers.filter(p => selectedPowerIds.has(p.id)).length;
  const groundCount = grounds.filter(g => selectedGroundIds.has(g.id)).length;
  const totalCount = strokeCount + componentCount + powerCount + groundCount;

  // Handle notes change
  const handleNotesChange = (id: string, value: string) => {
    // Limit to max length
    const truncatedValue = value.length > MAX_NOTES_LENGTH ? value.substring(0, MAX_NOTES_LENGTH) : value;
    setNotesMap(prev => {
      const newMap = new Map(prev);
      newMap.set(id, truncatedValue);
      return newMap;
    });
  };

  // Save notes to objects
  const handleSave = () => {
    // Update components
    setComponentsTop(prev => prev.map(c => {
      if (selectedComponentIds.has(c.id) && notesMap.has(c.id)) {
        const notes = notesMap.get(c.id) || '';
        return { ...c, notes: notes.trim() === '' ? null : notes.trim() };
      }
      return c;
    }));
    setComponentsBottom(prev => prev.map(c => {
      if (selectedComponentIds.has(c.id) && notesMap.has(c.id)) {
        const notes = notesMap.get(c.id) || '';
        return { ...c, notes: notes.trim() === '' ? null : notes.trim() };
      }
      return c;
    }));

    // Update drawing strokes
    setDrawingStrokes(prev => prev.map(s => {
      if (selectedIds.has(s.id) && notesMap.has(s.id)) {
        const notes = notesMap.get(s.id) || '';
        return { ...s, notes: notes.trim() === '' ? null : notes.trim() };
      }
      return s;
    }));

    // Update power symbols
    setPowerSymbols(prev => prev.map(p => {
      if (selectedPowerIds.has(p.id) && notesMap.has(p.id)) {
        const notes = notesMap.get(p.id) || '';
        return { ...p, notes: notes.trim() === '' ? null : notes.trim() };
      }
      return p;
    }));

    // Update ground symbols
    setGroundSymbols(prev => prev.map(g => {
      if (selectedGroundIds.has(g.id) && notesMap.has(g.id)) {
        const notes = notesMap.get(g.id) || '';
        return { ...g, notes: notes.trim() === '' ? null : notes.trim() };
      }
      return g;
    }));
  };

  return (
    <div style={dialogStyle}>
      {/* Fixed header - does not scroll */}
      <div 
        onMouseDown={(e) => {
          // Only start dragging if clicking on the header (not buttons)
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.closest('button')) {
            return;
          }
          if (position) {
            onDragStart(e);
          }
        }}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '6px',
          borderBottom: '1px solid #e0e0e0',
          background: '#888', // Medium gray background for grabbable window border
          cursor: isDragging ? 'grabbing' : (position ? 'grab' : 'default'),
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Notes (N)</h2>
        <button
          onClick={onClose}
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
      <div style={contentStyle}>
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
          <div style={{
            padding: '12px 16px',
            backgroundColor: totalCount > 0 ? '#e8e8e8' : '#fff3cd',
            borderBottom: '2px solid #ccc',
            fontSize: '13px',
            fontWeight: 600,
            color: totalCount > 0 ? '#333' : '#856404',
            marginBottom: '8px'
          }}>
            {totalCount > 0 ? `${totalCount} Object${totalCount !== 1 ? 's' : ''} Selected` : 'Zero Objects Selected'}
          </div>

          {totalCount === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No objects selected. Select one or more objects to add or edit notes.
            </div>
          ) : (
            <>
              {/* Components */}
              {[...componentsTop, ...componentsBottom]
                .filter(c => selectedComponentIds.has(c.id))
                .map((comp) => {
                  const notes = notesMap.get(comp.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={comp.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {formatComponentTypeName(comp.componentType)}{comp.designator && comp.designator.trim() ? ` (${comp.designator.trim()})` : ''}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(comp.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Vias */}
              {drawingStrokes
                .filter(s => selectedIds.has(s.id) && s.type === 'via' && s.points.length > 0)
                .map((stroke) => {
                  const point = stroke.points[0];
                  const viaType = (stroke as any).viaType || (point.id !== undefined ? determineViaType(point.id, powerBuses) : 'Via');
                  const notes = notesMap.get(stroke.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={stroke.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {viaType}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          {point.id && <div>Node ID: {point.id}</div>}
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(stroke.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Pads */}
              {drawingStrokes
                .filter(s => selectedIds.has(s.id) && s.type === 'pad' && s.points.length > 0)
                .map((stroke) => {
                  const point = stroke.points[0];
                  const padType = (stroke as any).padType || (point.id !== undefined ? determinePadType(point.id, powerBuses) : 'Pad (Signal)');
                  const notes = notesMap.get(stroke.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={stroke.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {padType}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          {point.id && <div>Node ID: {point.id}</div>}
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(stroke.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Test Points */}
              {drawingStrokes
                .filter(s => selectedIds.has(s.id) && s.type === 'testPoint' && s.points.length > 0)
                .map((stroke) => {
                  const point = stroke.points[0];
                  const testPointType = (stroke as any).testPointType || (point.id !== undefined ? determineTestPointType(point.id, powerBuses) : 'Test Point (Signal)');
                  const notes = notesMap.get(stroke.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={stroke.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {testPointType}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          {point.id && <div>Node ID: {point.id}</div>}
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(stroke.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Traces */}
              {drawingStrokes
                .filter(s => selectedIds.has(s.id) && s.type === 'trace')
                .map((stroke) => {
                  const notes = notesMap.get(stroke.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={stroke.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {stroke.type || 'unknown'}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(stroke.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Power Symbols */}
              {powers
                .filter(p => selectedPowerIds.has(p.id))
                .map((power) => {
                  const bus = powerBuses.find(b => b.id === power.powerBusId);
                  const powerType = power.type || (bus ? `${bus.name} Power Node` : 'Power Node');
                  const notes = notesMap.get(power.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={power.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {powerType}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          <div>Node ID: {power.pointId || '(not assigned)'}</div>
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(power.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Ground Symbols */}
              {grounds
                .filter(g => selectedGroundIds.has(g.id))
                .map((ground) => {
                  const groundType = ground.type || 'Ground Node';
                  const notes = notesMap.get(ground.id) || '';
                  const charCount = notes.length;
                  return (
                    <div key={ground.id} style={{ marginTop: '8px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                      <div style={{ backgroundColor: '#000', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                        <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type: </label>
                        <div style={{
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {groundType}
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          <div>Node ID: {ground.pointId || '(not assigned)'}</div>
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => handleNotesChange(ground.id, e.target.value)}
                          placeholder="Enter notes (max 200 characters)..."
                          maxLength={MAX_NOTES_LENGTH}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '8px',
                            fontSize: '11px',
                            fontFamily: 'sans-serif',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ marginTop: '4px', fontSize: '10px', color: charCount >= MAX_NOTES_LENGTH ? '#d32f2f' : '#666', textAlign: 'right' }}>
                          {charCount} / {MAX_NOTES_LENGTH}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Buttons - Close on left (standard color), Save on right (blue, primary action) */}
              <div style={{ marginTop: '20px', padding: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #ddd' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    backgroundColor: '#757575',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#616161';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#757575';
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1976D2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2196F3';
                  }}
                >
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
