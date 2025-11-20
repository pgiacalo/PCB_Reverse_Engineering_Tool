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
 * DetailedInfoDialog component
 * Displays detailed information about selected PCB elements (components, vias, pads, traces, power, ground)
 */

import React from 'react';
import type { PCBComponent } from '../../types';
import type { PowerSymbol, GroundSymbol, PowerBus } from '../../hooks/usePowerGround';

// DrawingStroke type matches App.tsx's local interface
interface DrawingStroke {
  id: string;
  points: Array<{ x: number; y: number; id?: number }>;
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via' | 'pad';
  viaType?: string;
  padType?: string;
}

export interface DetailedInfoDialogProps {
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
  /** Utility function to determine via type */
  determineViaType: (nodeId: number, powerBuses: PowerBus[]) => string;
  /** Utility function to determine pad type */
  determinePadType: (nodeId: number, powerBuses: PowerBus[]) => string;
}

export const DetailedInfoDialog: React.FC<DetailedInfoDialogProps> = ({
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
  determineViaType,
  determinePadType,
}) => {
  if (!visible) return null;

  return (
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
            onClick={onClose}
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
                            .map(s => {
                              const id = s.points[0].id;
                              if (id === undefined) throw new Error('Unexpected undefined id');
                              return {
                                stroke: s,
                                nodeId: id
                              };
                            })
                            .sort((a, b) => a.nodeId - b.nodeId); // Sort by Node ID ascending

                          // If no pads, get vias instead
                          const selectedItems = selectedPads.length > 0
                            ? selectedPads
                            : drawingStrokes
                                .filter(s => selectedIds.has(s.id) && s.type === 'via' && s.points.length > 0 && s.points[0].id !== undefined)
                                .map(s => {
                                  const id = s.points[0].id;
                                  if (id === undefined) throw new Error('Unexpected undefined id');
                                  return {
                                    stroke: s,
                                    nodeId: id
                                  };
                                })
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
                  
                  {/* Type-specific properties - essential properties shown first, right after main value */}
                  {comp.componentType === 'Resistor' && (
                    <>
                      {(comp as any).resistance && <div>Resistance: {(comp as any).resistance}</div>}
                      {/* Essential resistor properties - right after Resistance */}
                      {(comp as any).power && <div>Power: {(comp as any).power}</div>}
                      {(comp as any).tolerance && <div>Tolerance: {(comp as any).tolerance}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Capacitor' && (
                    <>
                      {(comp as any).capacitance && <div>Capacitance: {(comp as any).capacitance}</div>}
                      {/* Essential capacitor properties - right after Capacitance */}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).dielectric && <div>Dielectric: {(comp as any).dielectric}</div>}
                      {(comp as any).tolerance && <div>Tolerance: {(comp as any).tolerance}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'CapacitorElectrolytic' && (
                    <>
                      {(comp as any).capacitance && <div>Capacitance: {(comp as any).capacitance}</div>}
                      {/* Essential electrolytic capacitor properties - right after Capacitance */}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).tolerance && <div>Tolerance: {(comp as any).tolerance}</div>}
                      {(comp as any).polarity && <div>Polarity: {(comp as any).polarity}</div>}
                      {(comp as any).esr && <div>ESR: {(comp as any).esr}</div>}
                      {(comp as any).temperature && <div>Temperature: {(comp as any).temperature}</div>}
                    </>
                  )}
                  
                  {comp.orientation !== undefined && comp.orientation !== null && (
                    <div>Orientation: {comp.orientation}°</div>
                  )}
                  
                  {comp.pinConnections && comp.pinConnections.length > 0 && (() => {
                    // Determine if this component type has polarity
                    // Determine if this component type has polarity
                    const hasPolarity = comp.componentType === 'CapacitorElectrolytic' || 
                                       comp.componentType === 'Diode' || // Includes LEDs
                                       comp.componentType === 'Battery' || 
                                       comp.componentType === 'ZenerDiode' ||
                                       comp.componentType === 'Transistor' ||
                                       comp.componentType === 'IntegratedCircuit';
                    // Also check for tantalum capacitors
                    const isTantalumCap = comp.componentType === 'Capacitor' && 
                                         'dielectric' in comp && 
                                         (comp as any).dielectric === 'Tantalum';
                    const showPolarityColumn = hasPolarity || isTantalumCap;
                    
                    return (
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
                              {showPolarityColumn && (
                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>Polarity</th>
                              )}
                              <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>Node ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comp.pinConnections.map((conn, idx) => {
                              const polarity = comp.pinPolarities && comp.pinPolarities.length > idx ? comp.pinPolarities[idx] : '';
                              return (
                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{idx + 1}</td>
                                  {showPolarityColumn && (
                                    <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: polarity === '+' ? '#d32f2f' : polarity === '-' ? '#1976d2' : '#999' }}>
                                      {polarity || '-'}
                                    </td>
                                  )}
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{conn || '(not connected)'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                  {'manufacturer' in comp && (comp as any).manufacturer && (
                    <div>Manufacturer: {(comp as any).manufacturer}</div>
                  )}
                  {'partNumber' in comp && (comp as any).partNumber && (
                    <div>Part Number: {(comp as any).partNumber}</div>
                  )}
                  
                  {comp.componentType === 'Diode' && (
                    <>
                      {(comp as any).diodeType && <div>Type: {(comp as any).diodeType}</div>}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                      {(comp as any).ledColor && <div>LED Color: {(comp as any).ledColor}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Battery' && (
                    <>
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).capacity && <div>Capacity: {(comp as any).capacity}</div>}
                      {(comp as any).chemistry && <div>Chemistry: {(comp as any).chemistry}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Fuse' && (
                    <>
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).fuseType && <div>Type: {(comp as any).fuseType}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'FerriteBead' && (
                    <>
                      {(comp as any).impedance && <div>Impedance: {(comp as any).impedance}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Connector' && (
                    <>
                      {(comp as any).connectorType && <div>Type: {(comp as any).connectorType}</div>}
                      {(comp as any).gender && <div>Gender: {(comp as any).gender}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Jumper' && (
                    <>
                      {(comp as any).positions && <div>Positions: {(comp as any).positions}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Relay' && (
                    <>
                      {(comp as any).coilVoltage && <div>Coil Voltage: {(comp as any).coilVoltage}</div>}
                      {(comp as any).contactType && <div>Contact Type: {(comp as any).contactType}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Inductor' && (
                    <>
                      {(comp as any).inductance && <div>Inductance: {(comp as any).inductance}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                      {(comp as any).resistance && <div>DC Resistance: {(comp as any).resistance}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Speaker' && (
                    <>
                      {(comp as any).impedance && <div>Impedance: {(comp as any).impedance}</div>}
                      {(comp as any).power && <div>Power: {(comp as any).power}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Motor' && (
                    <>
                      {(comp as any).motorType && <div>Type: {(comp as any).motorType}</div>}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'PowerSupply' && (
                    <>
                      {(comp as any).inputVoltage && <div>Input Voltage: {(comp as any).inputVoltage}</div>}
                      {(comp as any).outputVoltage && <div>Output Voltage: {(comp as any).outputVoltage}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Transistor' && (
                    <>
                      {(comp as any).transistorType && <div>Type: {(comp as any).transistorType}</div>}
                      {(comp as any).polarity && <div>Polarity: {(comp as any).polarity}</div>}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'ResistorNetwork' && (
                    <>
                      {(comp as any).resistance && <div>Resistance: {(comp as any).resistance}</div>}
                      {(comp as any).configuration && <div>Configuration: {(comp as any).configuration}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Thermistor' && (
                    <>
                      {(comp as any).resistance && <div>Resistance: {(comp as any).resistance}</div>}
                      {(comp as any).thermistorType && <div>Type: {(comp as any).thermistorType}</div>}
                      {(comp as any).beta && <div>Beta: {(comp as any).beta}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Switch' && (
                    <>
                      {(comp as any).switchType && <div>Type: {(comp as any).switchType}</div>}
                      {(comp as any).current && <div>Current: {(comp as any).current}</div>}
                      {(comp as any).voltage && <div>Voltage: {(comp as any).voltage}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Transformer' && (
                    <>
                      {(comp as any).primaryVoltage && <div>Primary Voltage: {(comp as any).primaryVoltage}</div>}
                      {(comp as any).secondaryVoltage && <div>Secondary Voltage: {(comp as any).secondaryVoltage}</div>}
                      {(comp as any).power && <div>Power: {(comp as any).power}</div>}
                      {(comp as any).turns && <div>Turns Ratio: {(comp as any).turns}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'TestPoint' && (
                    <>
                      {(comp as any).signal && <div>Signal: {(comp as any).signal}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'IntegratedCircuit' && (
                    <>
                      {(comp as any).description && <div>Description: {(comp as any).description}</div>}
                      {(comp as any).icType && <div>IC Type: {(comp as any).icType}</div>}
                      {(comp as any).datasheet && <div>Datasheet: <a href={(comp as any).datasheet} target="_blank" rel="noopener noreferrer">{(comp as any).datasheet}</a></div>}
                    </>
                  )}
                  
                  {comp.componentType === 'VacuumTube' && (
                    <>
                      {(comp as any).tubeType && <div>Type: {(comp as any).tubeType}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'VariableResistor' && (
                    <>
                      {(comp as any).vrType && <div>Type: {(comp as any).vrType}</div>}
                      {(comp as any).resistance && <div>Resistance: {(comp as any).resistance}</div>}
                      {(comp as any).power && <div>Power: {(comp as any).power}</div>}
                      {(comp as any).taper && <div>Taper: {(comp as any).taper}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'Crystal' && (
                    <>
                      {(comp as any).frequency && <div>Frequency: {(comp as any).frequency}</div>}
                      {(comp as any).loadCapacitance && <div>Load Capacitance: {(comp as any).loadCapacitance}</div>}
                      {(comp as any).tolerance && <div>Tolerance: {(comp as any).tolerance}</div>}
                    </>
                  )}
                  
                  {comp.componentType === 'ZenerDiode' && (
                    <>
                      {(comp as any).voltage && <div>Zener Voltage: {(comp as any).voltage}</div>}
                      {(comp as any).power && <div>Power: {(comp as any).power}</div>}
                      {(comp as any).tolerance && <div>Tolerance: {(comp as any).tolerance}</div>}
                    </>
                  )}
                  
                  {/* Less important details shown at the end */}
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee', fontSize: '10px', color: '#999' }}>
                    <div>Position: x={comp.x.toFixed(2)}, y={comp.y.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ));
          })()}

          {/* Vias - Formatted UI */}
          {selectedIds.size > 0 && drawingStrokes.filter(s => selectedIds.has(s.id) && s.type === 'via' && s.points.length > 0).map((stroke) => {
            const point = stroke.points[0];
            // Determine via type - all vias are "Top and Bottom" since blind vias aren't supported yet
            // Vias always have an id, so this is safe
            const viaType = (stroke as any).viaType || (point.id !== undefined ? determineViaType(point.id, powerBuses) : 'Via (Signal)');
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
            const padType = (stroke as any).padType || (point.id !== undefined ? determinePadType(point.id, powerBuses) : 'Pad (Signal)');
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
  );
};

