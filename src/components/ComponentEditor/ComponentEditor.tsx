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

/**
 * ComponentEditor component
 * Dialog for editing component properties
 */

import React from 'react';
import type { PCBComponent } from '../../types';
import type { ComponentDefinition } from '../../data/componentDefinitions.d';
import { COMPONENT_TYPE_INFO, formatComponentTypeName } from '../../constants';
import { ComponentTypeFields } from './ComponentTypeFields';
import { resolveComponentDefinition } from '../../utils/componentDefinitionResolver';
import { isComponentPolarized } from '../../utils/components';

// Helper function to get default abbreviation from component type
const getDefaultAbbreviation = (componentType: string): string => {
  const info = COMPONENT_TYPE_INFO[componentType as keyof typeof COMPONENT_TYPE_INFO];
  if (!info || !info.prefix || info.prefix.length < 1) {
    return '?';
  }
  // Use just the first letter of the first prefix
  const firstPrefix = info.prefix[0];
  return firstPrefix.substring(0, 1).toUpperCase();
};

export interface ComponentEditorProps {
  /** Component editor state */
  componentEditor: {
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
    orientation?: number;
    [key: string]: any; // For type-specific fields
  } | null;
  /** Component definition (metadata) */
  componentDefinition?: ComponentDefinition;
  /** Set component editor state */
  setComponentEditor: (editor: any) => void;
  /** Components on top layer */
  componentsTop: PCBComponent[];
  /** Components on bottom layer */
  componentsBottom: PCBComponent[];
  /** Set components on top layer */
  setComponentsTop: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  /** Set components on bottom layer */
  setComponentsBottom: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  /** Connecting pin state */
  connectingPin: { componentId: string; pinIndex: number } | null;
  /** Set connecting pin state */
  setConnectingPin: (pin: { componentId: string; pinIndex: number } | null) => void;
  /** Dialog position */
  componentDialogPosition: { x: number; y: number } | null;
  /** Set dialog position */
  setComponentDialogPosition: (pos: { x: number; y: number } | null) => void;
  /** Is dragging dialog */
  isDraggingDialog: boolean;
  /** Set is dragging dialog */
  setIsDraggingDialog: (dragging: boolean) => void;
  /** Dialog drag offset */
  dialogDragOffset: { x: number; y: number } | null;
  /** Set dialog drag offset */
  setDialogDragOffset: (offset: { x: number; y: number } | null) => void;
  /** Are components locked */
  areComponentsLocked: boolean;
  /** Set selected component IDs */
  setSelectedComponentIds: (ids: Set<string>) => void;
  /** Set notes dialog visible */
  setNotesDialogVisible: (visible: boolean) => void;
}

export const ComponentEditor: React.FC<ComponentEditorProps> = ({
  componentEditor,
  componentDefinition,
  setComponentEditor,
  componentsTop,
  componentsBottom,
  setComponentsTop,
  setComponentsBottom,
  connectingPin,
  setConnectingPin,
  componentDialogPosition,
  setComponentDialogPosition: _setComponentDialogPosition,
  isDraggingDialog,
  setIsDraggingDialog,
  dialogDragOffset: _dialogDragOffset,
  setDialogDragOffset,
  areComponentsLocked,
  setSelectedComponentIds,
  setNotesDialogVisible,
}) => {
  if (!componentEditor || !componentEditor.visible) {
    return null;
  }

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

  // Update component function - handles all component type-specific save logic
  const updateComponent = (comp: PCBComponent): PCBComponent => {
    const updated = { ...comp };
    // Always use the designator field value directly (not abbreviation)
    // The designator field is the source of truth for the component's designator
    const designator = componentEditor.designator?.trim() || '';
    updated.designator = designator;
    updated.x = componentEditor.x;
    updated.y = componentEditor.y;
    updated.layer = componentEditor.layer;
    updated.orientation = componentEditor.orientation ?? 0;
    // Derive abbreviation from designator (first character)
    const abbreviation = designator.length > 0 ? designator.charAt(0).toUpperCase() : getDefaultAbbreviation(comp.componentType);
    (updated as any).abbreviation = abbreviation;
    if ('manufacturer' in updated) {
      (updated as any).manufacturer = componentEditor.manufacturer?.trim() || undefined;
    }
    if ('partNumber' in updated) {
      (updated as any).partNumber = componentEditor.partNumber?.trim() || undefined;
    }
    // Update pin count if changed
    if (componentEditor.pinCount !== comp.pinCount) {
      updated.pinCount = componentEditor.pinCount;
      // Resize pinConnections array, preserving existing connections
      const currentConnections = comp.pinConnections || [];
      updated.pinConnections = new Array(componentEditor.pinCount).fill('').map((_, i) => 
        i < currentConnections.length ? currentConnections[i] : ''
      );
      // Resize pinPolarities array if it exists, preserving existing polarities
      if (comp.pinPolarities) {
        const currentPolarities = comp.pinPolarities || [];
        updated.pinPolarities = new Array(componentEditor.pinCount).fill('').map((_, i) => 
          i < currentPolarities.length ? currentPolarities[i] : ''
        );
      }
      // Resize pinNames array if it exists, preserving existing names
      if ((comp as any).pinNames) {
        const currentPinNames = (comp as any).pinNames || [];
        (updated as any).pinNames = new Array(componentEditor.pinCount).fill('').map((_, i) => 
          i < currentPinNames.length ? currentPinNames[i] : ''
        );
      }
    } else {
      // Preserve existing pinConnections even if pin count didn't change
      updated.pinConnections = comp.pinConnections || [];
      // Preserve existing pinPolarities if they exist
      if (comp.pinPolarities) {
        updated.pinPolarities = comp.pinPolarities;
      }
      // Preserve existing pinNames if they exist
      if ((comp as any).pinNames) {
        (updated as any).pinNames = (comp as any).pinNames;
      }
    }
    
    // Update type-specific fields based on component type
    // Save separate value and unit fields
    if (comp.componentType === 'Resistor') {
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
    } else if (comp.componentType === 'Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      (updated as any).dielectric = componentEditor.dielectric || undefined;
    } else if (comp.componentType === 'Electrolytic Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      // polarized is now a fixed property from definition, not user-editable
      (updated as any).esr = componentEditor.esr || undefined;
      (updated as any).esrUnit = componentEditor.esrUnit || undefined;
      (updated as any).temperature = componentEditor.temperature || undefined;
    } else if (comp.componentType === 'Film Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      (updated as any).filmType = componentEditor.filmType || undefined;
    } else if (comp.componentType === 'Diode') {
      // Pre-fill diodeType from component's diodeType property (set during creation from radio button selection)
      (updated as any).diodeType = componentEditor.diodeType || (comp as any).diodeType || 'Standard';
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).ledColor = componentEditor.ledColor || undefined;
    } else if (comp.componentType === 'Battery') {
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).capacity = componentEditor.capacity || undefined;
      (updated as any).capacityUnit = componentEditor.capacityUnit || undefined;
      (updated as any).chemistry = componentEditor.chemistry || undefined;
    } else if (comp.componentType === 'Fuse') {
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).fuseType = componentEditor.fuseType || undefined;
    } else if (comp.componentType === 'FerriteBead') {
      (updated as any).impedance = componentEditor.impedance || undefined;
      (updated as any).impedanceUnit = componentEditor.impedanceUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'Connector') {
      (updated as any).connectorType = componentEditor.connectorType || undefined;
      (updated as any).gender = componentEditor.gender || undefined;
    } else if (comp.componentType === 'Jumper') {
      (updated as any).positions = componentEditor.positions || undefined;
    } else if (comp.componentType === 'Relay') {
      (updated as any).coilVoltage = componentEditor.coilVoltage || undefined;
      (updated as any).coilVoltageUnit = componentEditor.coilVoltageUnit || undefined;
      (updated as any).contactType = componentEditor.contactType || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'Inductor') {
      (updated as any).inductance = componentEditor.inductance || undefined;
      (updated as any).inductanceUnit = componentEditor.inductanceUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
    } else if (comp.componentType === 'Speaker') {
      (updated as any).impedance = componentEditor.impedance || undefined;
      (updated as any).impedanceUnit = componentEditor.impedanceUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
    } else if (comp.componentType === 'Motor') {
      (updated as any).motorType = componentEditor.motorType || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'PowerSupply') {
      (updated as any).inputVoltage = componentEditor.inputVoltage || undefined;
      (updated as any).inputVoltageUnit = componentEditor.inputVoltageUnit || undefined;
      (updated as any).outputVoltage = componentEditor.outputVoltage || undefined;
      (updated as any).outputVoltageUnit = componentEditor.outputVoltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'Transistor') {
      (updated as any).transistorType = componentEditor.transistorType || undefined;
      (updated as any).polarity = componentEditor.polarity || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'ResistorNetwork') {
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      (updated as any).configuration = componentEditor.configuration || undefined;
    } else if (comp.componentType === 'Thermistor') {
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      (updated as any).thermistorType = componentEditor.thermistorType || undefined;
      (updated as any).beta = componentEditor.beta || undefined;
    } else if (comp.componentType === 'Switch') {
      (updated as any).switchType = componentEditor.switchType || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
    } else if (comp.componentType === 'Transformer') {
      (updated as any).primaryVoltage = componentEditor.primaryVoltage || undefined;
      (updated as any).primaryVoltageUnit = componentEditor.primaryVoltageUnit || undefined;
      (updated as any).secondaryVoltage = componentEditor.secondaryVoltage || undefined;
      (updated as any).secondaryVoltageUnit = componentEditor.secondaryVoltageUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).turns = componentEditor.turns || undefined;
    } else if (comp.componentType === 'TestPoint') {
      (updated as any).signal = componentEditor.signal || undefined;
    } else if ((comp.componentType as string) === 'Film Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      (updated as any).filmType = componentEditor.filmType || undefined;
    } else if (comp.componentType === 'IntegratedCircuit') {
      // For ICs, save description from the Description field
      (updated as any).description = componentEditor.description?.trim() || undefined;
      (updated as any).datasheet = componentEditor.datasheet?.trim() || undefined;
      (updated as any).icType = componentEditor.icType || undefined;
    } else {
      // For non-IC components, save description from the Description field
      (updated as any).description = componentEditor.description?.trim() || undefined;
    }
    
    if (comp.componentType === 'VacuumTube') {
      (updated as any).tubeType = componentEditor.tubeType || undefined;
    } else if (comp.componentType === 'VariableResistor') {
      (updated as any).vrType = componentEditor.vrType || undefined;
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).taper = componentEditor.taper || undefined;
    } else if (comp.componentType === 'Crystal') {
      (updated as any).frequency = componentEditor.frequency || undefined;
      (updated as any).loadCapacitance = componentEditor.loadCapacitance || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
    } else if (comp.componentType === 'GenericComponent') {
      (updated as any).genericType = componentEditor.genericType || 'Attenuator';
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).power = componentEditor.power || undefined;
      (updated as any).frequency = componentEditor.frequency || undefined;
      (updated as any).model = componentEditor.model || undefined;
    }
    
    return updated;
  };

  const handleSave = () => {
    // Don't allow saving if components are locked
    if (areComponentsLocked) {
      alert('Cannot edit: Components are locked. Unlock components to edit them.');
      return;
    }

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
  };

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
        top: componentDialogPosition ? `${componentDialogPosition.y}px` : '90px',
        left: componentDialogPosition ? `${componentDialogPosition.x}px` : `${window.innerWidth - 280}px`,
        transform: 'none', // Position from top-left corner, not centered
        background: connectingPin && connectingPin.componentId === comp.id ? 'rgba(255, 255, 255, 0.95)' : '#fff',
        border: '1px solid #0b5fff',
        borderRadius: 4,
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '350px',
        width: '350px',
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
        padding: '6px 20px 6px 6px', // Extra right padding for scrollbar
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}>
        {/* Category and Type (read-only) - at the top for clarity */}
        {(() => {
          // Resolve component definition if not provided as prop
          const def = componentDefinition || resolveComponentDefinition(comp as any);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                Category:
              </label>
              <div style={{ width: '180px', padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '10px', color: '#000' }}>
                {def?.category || 'N/A'}
              </div>
            </div>
          );
        })()}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Type:
          </label>
          <div style={{ width: '180px', padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '10px', color: '#000' }}>
            {(() => {
              // Resolve component definition if not provided as prop
              const def = componentDefinition || resolveComponentDefinition(comp as any);
              // Prefer definition.displayName if available (most accurate) - same logic as Information dialog
              if (def?.displayName) {
                // For capacitors, append "Capacitor" if displayName doesn't already include it
                if (comp.componentType === 'Capacitor' && !def.displayName.toLowerCase().includes('capacitor')) {
                  return `${def.displayName} Capacitor`;
                }
                return def.displayName;
              }
              // Fallback to legacy logic for components without definitions
              if (comp.componentType === 'GenericComponent' && (comp as any).genericType) {
                return formatComponentTypeName((comp as any).genericType);
              }
              if (comp.componentType === 'Diode' && (comp as any).diodeType && (comp as any).diodeType !== 'Standard') {
                return formatComponentTypeName((comp as any).diodeType);
              }
              if (comp.componentType === 'VariableResistor' && (comp as any).vrType && (comp as any).vrType !== 'Potentiometer') {
                return formatComponentTypeName((comp as any).vrType);
              }
              if (comp.componentType === 'Capacitor' && (comp as any).dielectric === 'Tantalum') {
                return 'Tantalum Capacitor';
              }
              if (comp.componentType === 'Capacitor' && (comp as any).capacitorType === 'Electrolytic') {
                return 'Electrolytic Capacitor';
              }
              if (comp.componentType === 'Capacitor' && (comp as any).capacitorType === 'Film') {
                return 'Film Capacitor';
              }
              return formatComponentTypeName(comp.componentType);
            })()}
          </div>
        </div>
        
        {/* Layer (editable) - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-layer-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Layer:
          </label>
          <select
            id={`component-layer-${comp.id}`}
            name={`component-layer-${comp.id}`}
            value={componentEditor.layer}
            onChange={(e) => setComponentEditor({ ...componentEditor, layer: e.target.value as 'top' | 'bottom' })}
            disabled={areComponentsLocked}
            style={{ width: '80px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          >
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
        
        {/* Orientation - moved near top for easy access */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-orientation-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Orientation:
          </label>
          <select
            id={`component-orientation-${comp.id}`}
            name={`component-orientation-${comp.id}`}
            value={componentEditor.orientation ?? 0}
            onChange={(e) => {
              const newOrientation = parseInt(e.target.value) || 0;
              // Update editor state
              setComponentEditor({ ...componentEditor, orientation: newOrientation });
              // Immediately update the component in the array for real-time visual feedback
              if (!areComponentsLocked) {
                const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                if (currentComp) {
                  const updatedComp = { ...currentComp, orientation: newOrientation };
                  if (componentEditor.layer === 'top') {
                    setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  } else {
                    setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  }
                }
              }
            }}
            disabled={areComponentsLocked}
            style={{ width: '70px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          >
            <option value="0">0°</option>
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>
        </div>
        
        {/* Type-specific value fields - moved near top for easy access */}
        <ComponentTypeFields
            component={comp}
            componentEditor={componentEditor}
            componentDefinition={componentDefinition}
          setComponentEditor={setComponentEditor}
          areComponentsLocked={areComponentsLocked}
          componentsTop={componentsTop}
          componentsBottom={componentsBottom}
          setComponentsTop={setComponentsTop}
          setComponentsBottom={setComponentsBottom}
        />
        
        {/* Designator - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0' }}>
          <label htmlFor={`component-designator-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Designator:
          </label>
          <input
            id={`component-designator-${comp.id}`}
            name={`component-designator-${comp.id}`}
            type="text"
            value={componentEditor.designator || ''}
            onChange={(e) => {
              const val = e.target.value;
              // Extract abbreviation (first letter) from designator for display purposes
              const newAbbreviation = val.length > 0 ? val.charAt(0).toUpperCase() : componentEditor.abbreviation;
              setComponentEditor({ ...componentEditor, designator: val, abbreviation: newAbbreviation });
            }}
            disabled={areComponentsLocked}
            style={{ width: '80px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', fontFamily: 'monospace', textTransform: 'uppercase', opacity: areComponentsLocked ? 0.6 : 1 }}
            placeholder="e.g., U2, R7, C1"
          />
        </div>
        
        {/* Description/Part Name - for all components */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-description-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Description:
          </label>
          <input
            id={`component-description-${comp.id}`}
            name={`component-description-${comp.id}`}
            type="text"
            value={componentEditor.description || ''}
            onChange={(e) => {
              // Description is always separate from designator for all component types
              setComponentEditor({ ...componentEditor, description: e.target.value });
            }}
            disabled={areComponentsLocked}
            style={{ width: '180px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
            placeholder=""
          />
        </div>
        
        {/* Notes - single line, clickable to open Notes dialog */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-notes-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Notes:
          </label>
          <input
            id={`component-notes-${comp.id}`}
            name={`component-notes-${comp.id}`}
            type="text"
            readOnly
            value={comp.notes || ''}
            onClick={() => {
              if (!areComponentsLocked) {
                // Select this component and open Notes dialog
                setSelectedComponentIds(new Set([comp.id]));
                setNotesDialogVisible(true);
              }
            }}
            disabled={areComponentsLocked}
            style={{ 
              width: '180px', 
              padding: '2px 3px', 
              background: '#f5f5f5', 
              border: '1px solid #ddd', 
              borderRadius: 2, 
              fontSize: '10px', 
              color: '#000', 
              opacity: areComponentsLocked ? 0.6 : 1,
              cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            placeholder="Click to edit notes..."
            title={comp.notes || 'Click to edit notes...'}
          />
        </div>
        
        {/* Pin Count - on one line (only for non-IC components; ICs show it under IC Properties) */}
        {comp.componentType !== 'IntegratedCircuit' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-pincount-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
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
                if (areComponentsLocked) {
                  alert('Cannot edit: Components are locked. Unlock components to edit them.');
                  return;
                }
                const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                if (currentComp && newPinCount !== currentComp.pinCount) {
                  const currentConnections = currentComp.pinConnections || [];
                  const newPinConnections = new Array(newPinCount).fill('').map((_, i) => 
                    i < currentConnections.length ? currentConnections[i] : ''
                  );
                  const currentPolarities = currentComp.pinPolarities || [];
                  const newPinPolarities = currentComp.pinPolarities ? new Array(newPinCount).fill('').map((_, i) => 
                    i < currentPolarities.length ? currentPolarities[i] : ''
                  ) : undefined;
                  const updatedComp = {
                    ...currentComp,
                    pinCount: newPinCount,
                    pinConnections: newPinConnections,
                    ...(newPinPolarities !== undefined && { pinPolarities: newPinPolarities }),
                  };
                  if (componentEditor.layer === 'top') {
                    setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  } else {
                    setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  }
                  setComponentEditor({ ...componentEditor, pinCount: newPinCount });
                }
              }}
              disabled={areComponentsLocked}
              style={{ width: '60px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
            />
          </div>
        )}
        
        {/* X - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-x-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
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
            style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          />
        </div>
        
        {/* Y - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-y-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
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
            style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          />
        </div>
        
        {/* Manufacturer - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-manufacturer-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Manufacturer:
          </label>
          <input
            id={`component-manufacturer-${comp.id}`}
            name={`component-manufacturer-${comp.id}`}
            type="text"
            value={componentEditor.manufacturer}
            onChange={(e) => setComponentEditor({ ...componentEditor, manufacturer: e.target.value })}
            disabled={areComponentsLocked}
            style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          />
        </div>
        
        {/* Part Number - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-partnumber-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Part Number:
          </label>
          <input
            id={`component-partnumber-${comp.id}`}
            name={`component-partnumber-${comp.id}`}
            type="text"
            value={componentEditor.partNumber}
            onChange={(e) => setComponentEditor({ ...componentEditor, partNumber: e.target.value })}
            disabled={areComponentsLocked}
            style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          />
        </div>
        
        {/* Pin Connections - tabular format with polarity column for components with polarity */}
        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
            Pin Connections:
          </label>
          {connectingPin && connectingPin.componentId === comp.id && (
            <div style={{ padding: '2px 3px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 2, marginBottom: '2px', fontSize: '8px', color: '#856404' }}>
              Pin {connectingPin.pinIndex + 1} selected. Click on a via or pad to connect.
            </div>
          )}
          {(() => {
            // Determine if this component type has polarity using definition
            const showPolarityColumn = isComponentPolarized(comp);
            
            // Get pin names from component instance (user-editable) or definition (defaults)
            const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
            const currentComp = currentCompList.find(c => c.id === componentEditor.id);
            const instancePinNames = (currentComp as any)?.pinNames as string[] | undefined;
            // Resolve definition if not provided as prop
            const resolvedDef = componentDefinition || resolveComponentDefinition(comp as any);
            const definitionPinNames = resolvedDef?.properties?.pinNames as string[] | undefined;
            
            // Data-driven: Show Name column if pinNames are defined in the definition
            // If pinNames contains "CHIP_DEPENDENT", use text input (for ICs with custom pin names)
            // Otherwise, use dropdown (for transistors, op amps with predefined names)
            const hasPinNames = definitionPinNames && definitionPinNames.length > 0;
            const isChipDependent = hasPinNames && definitionPinNames.includes('CHIP_DEPENDENT');
            const useDropdown = hasPinNames && !isChipDependent; // Dropdown for predefined names
            const useTextInput = isChipDependent; // Text input for CHIP_DEPENDENT
            const showNameColumn = hasPinNames; // Show if pinNames are defined
            
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginTop: '2px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd', background: '#f5f5f5' }}>
                    <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '8px', color: '#333', width: '20px' }}></th>
                    <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '8px', color: '#333', width: '40px' }}>Pin</th>
                    {showNameColumn && (
                      <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '8px', color: '#333', width: '70px' }}>Name</th>
                    )}
                    {showPolarityColumn && (
                      <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '8px', color: '#333', width: '50px' }}>Polarity</th>
                    )}
                    <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '8px', color: '#333' }}>Node ID</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: componentEditor.pinCount }, (_, i) => {
                    const pinConnection = currentComp?.pinConnections && currentComp.pinConnections.length > i ? currentComp.pinConnections[i] : '';
                    const pinPolarity = (currentComp?.pinPolarities && currentComp.pinPolarities.length > i) ? (currentComp.pinPolarities[i] || '') : '';
                    // Get pin name from instance (user-edited) or default from definition
                    // For CHIP_DEPENDENT, show empty string (user fills in custom names)
                    const instancePinName = instancePinNames && i < instancePinNames.length ? instancePinNames[i] : '';
                    const defaultPinName = definitionPinNames && i < definitionPinNames.length ? definitionPinNames[i] : '';
                    const isChipDependent = defaultPinName === 'CHIP_DEPENDENT';
                    // Use instance value if it exists and is not empty, otherwise use default (unless it's CHIP_DEPENDENT)
                    const currentPinName = (instancePinName && instancePinName.trim() !== '') ? instancePinName : 
                                          (isChipDependent ? '' : defaultPinName);
                    const isSelected = connectingPin && connectingPin.componentId === comp.id && connectingPin.pinIndex === i;
                    
                    return (
                      <tr
                        key={i}
                        style={{
                          cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                          background: isSelected ? '#e6f0ff' : pinConnection ? '#d4edda' : '#fff',
                          borderBottom: '1px solid #eee',
                        }}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName === 'SELECT') {
                            return;
                          }
                          if (areComponentsLocked) {
                            alert('Cannot edit: Components are locked. Unlock components to edit them.');
                            return;
                          }
                          if (isSelected) {
                            setConnectingPin(null);
                          } else {
                            setConnectingPin({ componentId: comp.id, pinIndex: i });
                          }
                        }}
                        title={pinConnection ? `Connected to: ${pinConnection}` : 'Select this pin, then click on a via or pad to connect'}
                      >
                        <td style={{ padding: '2px 4px', textAlign: 'center' }}>
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
                                setConnectingPin(null);
                              } else {
                                setConnectingPin({ componentId: comp.id, pinIndex: i });
                              }
                            }}
                            disabled={areComponentsLocked}
                            style={{ margin: 0, cursor: areComponentsLocked ? 'not-allowed' : 'pointer', opacity: areComponentsLocked ? 0.6 : 1, width: '10px', height: '10px' }}
                          />
                        </td>
                        <td style={{ padding: '2px 4px', color: '#333', fontWeight: isSelected ? 600 : 400, fontFamily: 'monospace' }}>
                          {i + 1}
                        </td>
                        {(useDropdown || useTextInput) && (
                          <td style={{ padding: '2px 4px', textAlign: 'left' }}>
                            {useDropdown ? (
                              // Transistor/Op Amp: Dropdown that displays and allows editing the pin name
                              <select
                                value={currentPinName || ''}
                                onChange={(e) => {
                                  if (areComponentsLocked) {
                                    alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                    return;
                                  }
                                  const newPinName = e.target.value;
                                  const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                                  const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                                  if (currentComp) {
                                    const existingPinNames = (currentComp as any).pinNames || 
                                                             (definitionPinNames ? [...definitionPinNames] : []);
                                    const newPinNames = [...existingPinNames];
                                    while (newPinNames.length < componentEditor.pinCount) {
                                      newPinNames.push('');
                                    }
                                    newPinNames[i] = newPinName;
                                    const updatedComp = { ...currentComp, pinNames: newPinNames };
                                    if (componentEditor.layer === 'top') {
                                      setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    } else {
                                      setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    }
                                  }
                                }}
                                disabled={areComponentsLocked}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                style={{ 
                                  padding: '2px 4px', 
                                  fontSize: '8px', 
                                  border: '1px solid #ddd', 
                                  borderRadius: 2, 
                                  background: '#fff',
                                  color: '#333',
                                  cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                                  opacity: areComponentsLocked ? 0.6 : 1,
                                  width: '100%',
                                  fontStyle: 'italic',
                                  minHeight: '18px'
                                }}
                              >
                                {definitionPinNames && definitionPinNames.length > 0 ? (
                                  // Filter out CHIP_DEPENDENT from dropdown options (it's only used as a marker)
                                  definitionPinNames.filter(name => name !== 'CHIP_DEPENDENT').map((name, idx) => (
                                    <option key={idx} value={name}>{name}</option>
                                  ))
                                ) : (
                                  <option value="">-</option>
                                )}
                              </select>
                            ) : (
                              // IC: Text input field
                              <input
                                type="text"
                                value={currentPinName || ''}
                                onChange={(e) => {
                                  if (areComponentsLocked) {
                                    alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                    return;
                                  }
                                  const newPinName = e.target.value;
                                  const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                                  const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                                  if (currentComp) {
                                    const existingPinNames = (currentComp as any).pinNames || [];
                                    const newPinNames = [...existingPinNames];
                                    while (newPinNames.length < componentEditor.pinCount) {
                                      newPinNames.push('');
                                    }
                                    newPinNames[i] = newPinName;
                                    const updatedComp = { ...currentComp, pinNames: newPinNames };
                                    if (componentEditor.layer === 'top') {
                                      setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    } else {
                                      setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    }
                                  }
                                }}
                                disabled={areComponentsLocked}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                placeholder="Pin name"
                                style={{ 
                                  padding: '1px 2px', 
                                  fontSize: '7px', 
                                  border: '1px solid #ddd', 
                                  borderRadius: 2, 
                                  background: '#fff',
                                  color: '#333',
                                  width: '100%',
                                  opacity: areComponentsLocked ? 0.6 : 1,
                                  cursor: areComponentsLocked ? 'not-allowed' : 'text'
                                }}
                              />
                            )}
                          </td>
                        )}
                        {showPolarityColumn && (
                          <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                            {pinConnection ? (
                              // Display polarity as read-only text when connected (like Information dialog)
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                color: pinPolarity === '+' ? '#d32f2f' : pinPolarity === '-' ? '#1976d2' : '#999'
                              }}>
                                {pinPolarity || '-'}
                              </span>
                            ) : (
                              // Allow editing polarity when not connected
                            <select
                              key={`polarity-${comp.id}-${i}-${pinPolarity}`}
                              value={pinPolarity ?? ''}
                              onChange={(e) => {
                                if (areComponentsLocked) {
                                  alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                  return;
                                }
                                const newPolarity = e.target.value as '+' | '-' | '';
                                const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                                const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                                if (currentComp) {
                                  const existingPolarities = currentComp.pinPolarities || new Array(currentComp.pinCount).fill('');
                                  const newPolarities = [...existingPolarities];
                                  while (newPolarities.length < currentComp.pinCount) {
                                    newPolarities.push('');
                                  }
                                  newPolarities[i] = newPolarity;
                                  const updatedComp = { ...currentComp, pinPolarities: newPolarities };
                                  if (componentEditor.layer === 'top') {
                                    setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                  } else {
                                    setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                  }
                                }
                              }}
                              disabled={areComponentsLocked}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.stopPropagation()}
                              style={{ 
                                padding: '1px 2px', 
                                fontSize: '8px', 
                                border: '1px solid #ddd', 
                                borderRadius: 2, 
                                background: '#fff',
                                cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                                opacity: areComponentsLocked ? 0.6 : 1,
                                width: '100%',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                              }}
                            >
                              <option value="">-</option>
                              <option value="+">+</option>
                              <option value="-">-</option>
                            </select>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '2px 4px', color: pinConnection ? '#28a745' : '#999', fontWeight: pinConnection ? 600 : 400, fontFamily: 'monospace' }}>
                          {pinConnection || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>

      {/* Fixed footer with buttons */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '6px',
        padding: '6px',
        borderTop: '1px solid #e0e0e0',
        flexShrink: 0,
      }}>
        <button
          onClick={() => {
            setComponentEditor(null);
            setConnectingPin(null); // Clear pin connection mode
          }}
          disabled={areComponentsLocked}
          style={{
            padding: '2px 5px',
            background: areComponentsLocked ? '#f5f5f5' : '#fff',
            color: areComponentsLocked ? '#999' : '#333',
            border: '1px solid #ddd',
            borderRadius: 2,
            cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            opacity: areComponentsLocked ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
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
};

