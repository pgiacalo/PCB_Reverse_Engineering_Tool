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
 * ComponentTypeFields component
 * Renders type-specific property fields for components
 */

import React from 'react';
import type { PCBComponent } from '../../types';
import { getPropertyUnits, getDefaultUnit } from '../../constants';
import type { ComponentDefinition, ComponentFieldDefinition } from '../../data/componentDefinitions.d';
import { resolveComponentDefinition } from '../../utils/componentDefinitionResolver';
import { isComponentPolarized } from '../../utils/components';

export interface ComponentTypeFieldsProps {
  component: PCBComponent;
  componentEditor: any;
  componentDefinition?: ComponentDefinition;
  setComponentEditor: (editor: any) => void;
  areComponentsLocked: boolean;
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  setComponentsTop: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  setComponentsBottom: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  uploadedDatasheetFile: File | null;
  setUploadedDatasheetFile: (file: File | null) => void;
}

export const ComponentTypeFields: React.FC<ComponentTypeFieldsProps> = ({
  component: comp,
  componentEditor,
  componentDefinition,
  setComponentEditor,
  areComponentsLocked,
  componentsTop: _componentsTop,
  componentsBottom: _componentsBottom,
  setComponentsTop: _setComponentsTop,
  setComponentsBottom: _setComponentsBottom,
  uploadedDatasheetFile: _uploadedDatasheetFile,
  setUploadedDatasheetFile: _setUploadedDatasheetFile,
}) => {
  // Validate component has required properties
  if (!comp || !comp.id || !comp.componentType || typeof comp.pinCount !== 'number') {
    console.error('[ComponentTypeFields] Component missing required properties:', { comp, hasId: !!comp?.id, hasComponentType: !!comp?.componentType, componentType: comp?.componentType, pinCount: comp?.pinCount, pinCountType: typeof comp?.pinCount });
    return null;
  }
  
  const def: ComponentDefinition | undefined =
    componentDefinition ||
    (componentEditor as any)?.componentDefinition ||
    resolveComponentDefinition(comp as any);
  const fields: ComponentFieldDefinition[] | undefined = def?.fields;

  // Check if this is an IntegratedCircuit component (used throughout)
  const compType = (comp as any).componentType;
  const isIntegratedCircuit = compType === 'IntegratedCircuit' || compType === 'Semiconductor';
  const isSemiconductor = compType === 'Semiconductor';
  const isIntegratedCircuitOnly = compType === 'IntegratedCircuit';

  // Dynamic rendering from component definition fields (if available)
  // For IntegratedCircuit (not Semiconductor), we skip dynamic rendering to use hardcoded section with file upload
  // For Semiconductor, we use dynamic rendering but skip the datasheet field (handled in hardcoded section)
  
  // Use dynamic rendering for components with fields, except for IntegratedCircuit (which uses hardcoded section)
  if (fields && fields.length > 0 && !isIntegratedCircuitOnly) {
    // Helper function to determine optimal field width based on field name and type
    const getFieldWidth = (fieldName: string, fieldType: string, hasUnits: boolean): string => {
      if (hasUnits) {
        // Fields with units - optimize width based on typical value ranges
        if (fieldName === 'capacitance' || fieldName === 'resistance' || fieldName === 'voltage' || fieldName === 'current') {
          return '80px'; // Medium numeric values: "1000", "10.5", etc.
        }
        if (fieldName === 'power' || fieldName === 'inductance' || fieldName === 'impedance') {
          return '70px'; // Smaller numeric values: "1/4", "10", etc.
        }
        if (fieldName === 'esr' || fieldName === 'ripple' || fieldName === 'leakageCurrent') {
          return '70px'; // Smaller values
        }
        return '80px'; // Default for fields with units
      }
      
      // Fields without units
      if (fieldName === 'tolerance' || fieldName === 'pinCount') {
        return '60px'; // Short values: "±5%", "2", etc.
      }
      if (fieldName === 'partNumber' || fieldName === 'manufacturer') {
        return '150px'; // Medium text fields
      }
      if (fieldName === 'description' || fieldName === 'operatingTemperature') {
        return '180px'; // Longer text fields
      }
      if (fieldType === 'string' && !fieldName.includes('Unit')) {
        return '150px'; // Default for string fields
      }
      return '120px'; // Default width
    };

    const renderField = (field: ComponentFieldDefinition) => {
      // Skip datasheet field for IntegratedCircuit - it's handled specially with file upload
      const compType = (comp as any).componentType;
      const isIntegratedCircuit = compType === 'IntegratedCircuit' || compType === 'Semiconductor';
      if (isIntegratedCircuit && field.name === 'datasheet') {
        return null; // Skip - will be rendered in the hardcoded section below
      }
      // Skip Manufacturer and Part Number for ICs - they're rendered in IC Properties section
      if (isIntegratedCircuit && (field.name === 'manufacturer' || field.name === 'partNumber')) {
        return null;
      }
      // Skip Description - it's rendered above Notes in ComponentEditor (for all component types)
      if (field.name === 'description') {
        return null;
      }
      
      const valueKey = field.name;
      const unitKey = `${field.name}Unit`;
      // Get value from componentEditor, component, or field default
      const value = (componentEditor as any)[valueKey] ?? (comp as any)[valueKey] ?? field.defaultValue ?? '';
      // Get unit from componentEditor, component, or field defaultUnit (prioritize field.defaultUnit if units exist)
      const unit = (componentEditor as any)[unitKey] ?? (comp as any)[unitKey] ?? (field.units && field.defaultUnit ? field.defaultUnit : '');

      const onValueChange = (val: string) => {
        // Use functional update to avoid stale closure issues
        // React state setters support functional updates: setState(prev => newState)
        // TypeScript doesn't know setComponentEditor accepts functions, so we cast it
        const updater = (prev: any) => {
          if (!prev) return prev;
          return { ...prev, [valueKey]: val };
        };
        (setComponentEditor as any)(updater);
      };
      const onUnitChange = (val: string) => {
        // Use functional update to avoid stale closure issues
        const updater = (prev: any) => {
          if (!prev) return prev;
          return { ...prev, [unitKey]: val };
        };
        (setComponentEditor as any)(updater);
      };

      const hasUnits = Boolean(field.units && field.units.length > 0);
      const fieldWidth = getFieldWidth(field.name, field.type, hasUnits);

      return (
        <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            {field.label}:
          </label>
          {field.type === 'enum' ? (
            <select
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={areComponentsLocked}
              style={{ width: fieldWidth, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}
            >
              {(field.enumValues || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={areComponentsLocked}
              style={{ width: fieldWidth, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: hasUnits ? '8px' : '0' }}
              placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ''}
            />
          )}
          {hasUnits && field.units && (
            <select
              value={unit || field.defaultUnit || field.units[0]}
              onChange={(e) => onUnitChange(e.target.value)}
              disabled={areComponentsLocked}
              style={{ width: '70px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, flexShrink: 0 }}
            >
              {field.units.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
        </div>
      );
    };

    // For semiconductors, we need to render dynamic fields AND the datasheet section
    // So we don't return early - instead, we'll render dynamic fields and continue to hardcoded section
    // For other components, just return the dynamic fields
    if (!isSemiconductor) {
    return (
      <>
        {fields.map(renderField).filter(Boolean)}
      </>
    );
    }
    
    // For semiconductors, don't return early - continue to hardcoded section below
    // The dynamic fields will be rendered in the hardcoded section along with datasheet
  }
  
  // For IntegratedCircuit, always render the hardcoded section (even without definition)
  // This ensures the file upload field is always available
  // For Semiconductor without fields, also use hardcoded section
  // Fallback: definition missing (only for non-IntegratedCircuit components)
  if (!isIntegratedCircuit) {
  return (
      <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: 4, color: '#856404', marginBottom: '8px', fontSize: '11px' }}>
      Component definition missing for this instance. Using legacy fields. Please ensure the component has a definition in componentDefinitions.json and a valid componentDefinitionKey.
    </div>
  );
  }

  // Legacy rendering - IntegratedCircuit always uses this path to ensure file upload is available
  // For Semiconductor, this section provides the datasheet upload (dynamic fields are rendered above if available)
  return (
    <>
      {/* Resistor */}
      {comp.componentType === 'Resistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
              <option value="1/20">1/20 W</option>
              <option value="1/16">1/16 W</option>
              <option value="1/10">1/10 W</option>
              <option value="1/8">1/8 W</option>
              <option value="1/4">1/4 W</option>
              <option value="1/2">1/2 W</option>
              <option value="1">1 W</option>
              <option value="2">2 W</option>
              <option value="3">3 W</option>
              <option value="5">5 W</option>
              <option value="10">10 W</option>
              <option value="25">25 W</option>
              <option value="50">50 W</option>
              <option value="100">100 W</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±5%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="±0.05%">±0.05%</option>
              <option value="±0.1%">±0.1%</option>
              <option value="±0.25%">±0.25%</option>
              <option value="±0.5%">±0.5%</option>
              <option value="±1%">±1%</option>
              <option value="±2%">±2%</option>
              <option value="±5%">±5%</option>
              <option value="±10%">±10%</option>
              <option value="±20%">±20%</option>
            </select>
          </div>
        </>
      )}

      {/* Capacitor */}
      {comp.componentType === 'Capacitor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-capacitance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacitance:</label>
            <input id={`component-capacitance-${comp.id}`} type="text" value={componentEditor.capacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacitance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.capacitanceUnit || getDefaultUnit('capacitance')} onChange={(e) => setComponentEditor({ ...componentEditor, capacitanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('capacitance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-dielectric-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Dielectric:</label>
            <select id={`component-dielectric-${comp.id}`} value={componentEditor.dielectric || 'Ceramic'} onChange={(e) => setComponentEditor({ ...componentEditor, dielectric: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Ceramic">Ceramic</option>
              <option value="Tantalum">Tantalum</option>
              <option value="Film">Film</option>
              <option value="Polyester">Polyester</option>
              <option value="Polypropylene">Polypropylene</option>
              <option value="Mica">Mica</option>
              <option value="Paper">Paper</option>
              <option value="Glass">Glass</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±10%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="±0.5%">±0.5%</option>
              <option value="±1%">±1%</option>
              <option value="±2%">±2%</option>
              <option value="±5%">±5%</option>
              <option value="±10%">±10%</option>
              <option value="±20%">±20%</option>
            </select>
          </div>
        </>
      )}

      {/* Film Capacitor */}
      {comp.componentType === 'Film Capacitor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-capacitance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacitance:</label>
            <input id={`component-capacitance-${comp.id}`} type="text" value={componentEditor.capacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacitance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.capacitanceUnit || getDefaultUnit('capacitance')} onChange={(e) => setComponentEditor({ ...componentEditor, capacitanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('capacitance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-filmtype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Film Type:</label>
            <select id={`component-filmtype-${comp.id}`} value={componentEditor.filmType || 'Polyester'} onChange={(e) => setComponentEditor({ ...componentEditor, filmType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Polyester">Polyester</option>
              <option value="Polypropylene">Polypropylene</option>
              <option value="Polyethylene">Polyethylene</option>
              <option value="Polystyrene">Polystyrene</option>
              <option value="Polycarbonate">Polycarbonate</option>
              <option value="PTFE">PTFE (Teflon)</option>
              <option value="PPS">PPS (Polyphenylene Sulfide)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±10%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="±0.5%">±0.5%</option>
              <option value="±1%">±1%</option>
              <option value="±2%">±2%</option>
              <option value="±5%">±5%</option>
              <option value="±10%">±10%</option>
              <option value="±20%">±20%</option>
            </select>
          </div>
        </>
      )}

      {/* Electrolytic Capacitor */}
      {comp.componentType === 'Electrolytic Capacitor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-capacitance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacitance:</label>
            <input id={`component-capacitance-${comp.id}`} type="text" value={componentEditor.capacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacitance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.capacitanceUnit || 'µF'} onChange={(e) => setComponentEditor({ ...componentEditor, capacitanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              <option value="pF">pF</option>
              <option value="nF">nF</option>
              <option value="µF">µF</option>
              <option value="mF">mF</option>
              <option value="F">F</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 25" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±20%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}>
              <option value="±0.5%">±0.5%</option>
              <option value="±1%">±1%</option>
              <option value="±2%">±2%</option>
              <option value="±5%">±5%</option>
              <option value="±10%">±10%</option>
              <option value="±20%">±20%</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-polarized-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Polarized:</label>
            <input
              id={`component-polarized-${comp.id}`}
              type="checkbox"
              checked={isComponentPolarized(comp)}
              disabled={true}
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              title="Polarized is a fixed property determined by component type"
            />
          </div>
        </>
      )}

      {/* Inductor */}
      {comp.componentType === 'Inductor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-inductance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Inductance:</label>
            <input id={`component-inductance-${comp.id}`} type="text" value={componentEditor.inductance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, inductance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.inductanceUnit || getDefaultUnit('inductance')} onChange={(e) => setComponentEditor({ ...componentEditor, inductanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('inductance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>DC Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.resistanceUnit || 'Ω'} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Diode */}
      {comp.componentType === 'Diode' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-diodetype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Diode Type:</label>
            <select id={`component-diodetype-${comp.id}`} value={componentEditor.diodeType || 'Standard'} onChange={(e) => setComponentEditor({ ...componentEditor, diodeType: e.target.value as 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Infrared' | 'Photodiode' | 'Other' })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Standard">Standard</option>
              <option value="Zener">Zener</option>
              <option value="LED">LED</option>
              <option value="Schottky">Schottky</option>
              <option value="Infrared">Infrared</option>
              <option value="Photodiode">Photodiode</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {componentEditor.diodeType === 'LED' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor={`component-ledcolor-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>LED Color:</label>
              <select id={`component-ledcolor-${comp.id}`} value={componentEditor.ledColor || ''} onChange={(e) => setComponentEditor({ ...componentEditor, ledColor: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
                <option value="">Select...</option>
                <option value="Red">Red</option>
                <option value="Green">Green</option>
                <option value="Blue">Blue</option>
                <option value="Yellow">Yellow</option>
                <option value="Orange">Orange</option>
                <option value="White">White</option>
                <option value="RGB">RGB</option>
                <option value="IR">IR (Infrared)</option>
                <option value="UV">UV (Ultraviolet)</option>
              </select>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Battery */}
      {comp.componentType === 'Battery' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 3.7" />
            <select value={componentEditor.voltageUnit || 'V'} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-capacity-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacity:</label>
            <input id={`component-capacity-${comp.id}`} type="text" value={componentEditor.capacity || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacity: e.target.value })} disabled={areComponentsLocked} style={{ width: '120px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 2000mAh" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-chemistry-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Chemistry:</label>
            <select id={`component-chemistry-${comp.id}`} value={componentEditor.chemistry || 'Li-ion'} onChange={(e) => setComponentEditor({ ...componentEditor, chemistry: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Li-ion">Li-ion</option>
              <option value="LiPo">LiPo</option>
              <option value="NiMH">NiMH</option>
              <option value="NiCd">NiCd</option>
              <option value="Alkaline">Alkaline</option>
              <option value="Lead-Acid">Lead-Acid</option>
              <option value="Lithium">Lithium</option>
              <option value="Zinc-Carbon">Zinc-Carbon</option>
            </select>
          </div>
        </>
      )}

      {/* Fuse */}
      {comp.componentType === 'Fuse' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 5" />
            <select value={componentEditor.currentUnit || 'A'} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 250" />
            <select value={componentEditor.voltageUnit || 'V'} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-fusetype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Fuse Type:</label>
            <select id={`component-fusetype-${comp.id}`} value={componentEditor.fuseType || 'Fast-blow'} onChange={(e) => setComponentEditor({ ...componentEditor, fuseType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Fast-blow">Fast-blow</option>
              <option value="Slow-blow">Slow-blow</option>
              <option value="Time-delay">Time-delay</option>
              <option value="Resettable">Resettable</option>
              <option value="Cartridge">Cartridge</option>
              <option value="Glass">Glass</option>
              <option value="Ceramic">Ceramic</option>
            </select>
          </div>
        </>
      )}

      {/* Relay */}
      {comp.componentType === 'Relay' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-coilvoltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Coil Voltage:</label>
            <input id={`component-coilvoltage-${comp.id}`} type="text" value={componentEditor.coilVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, coilVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.coilVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, coilVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-contacttype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Contact Type:</label>
            <select id={`component-contacttype-${comp.id}`} value={componentEditor.contactType || 'SPST'} onChange={(e) => setComponentEditor({ ...componentEditor, contactType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="SPST">SPST (Single Pole Single Throw)</option>
              <option value="SPDT">SPDT (Single Pole Double Throw)</option>
              <option value="DPST">DPST (Double Pole Single Throw)</option>
              <option value="DPDT">DPDT (Double Pole Double Throw)</option>
              <option value="3PDT">3PDT (3 Pole Double Throw)</option>
              <option value="4PDT">4PDT (4 Pole Double Throw)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Motor */}
      {comp.componentType === 'Motor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-motortype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Motor Type:</label>
            <select id={`component-motortype-${comp.id}`} value={componentEditor.motorType || 'DC'} onChange={(e) => setComponentEditor({ ...componentEditor, motorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="DC">DC Motor</option>
              <option value="Stepper">Stepper Motor</option>
              <option value="Servo">Servo Motor</option>
              <option value="Brushless">Brushless DC</option>
              <option value="AC">AC Motor</option>
              <option value="Synchronous">Synchronous</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Switch */}
      {comp.componentType === 'Switch' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-switchtype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Switch Type:</label>
            <select id={`component-switchtype-${comp.id}`} value={componentEditor.switchType || 'Toggle'} onChange={(e) => setComponentEditor({ ...componentEditor, switchType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Toggle">Toggle</option>
              <option value="Push-button">Push-button</option>
              <option value="Slide">Slide</option>
              <option value="Rotary">Rotary</option>
              <option value="DIP">DIP Switch</option>
              <option value="Momentary">Momentary</option>
              <option value="Latching">Latching</option>
              <option value="Reed">Reed Switch</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 5" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 250" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* FerriteBead */}
      {comp.componentType === 'FerriteBead' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-impedance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Impedance:</label>
            <input id={`component-impedance-${comp.id}`} type="text" value={componentEditor.impedance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, impedance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.impedanceUnit || getDefaultUnit('impedance')} onChange={(e) => setComponentEditor({ ...componentEditor, impedanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('impedance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Connector */}
      {comp.componentType === 'Connector' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-connectortype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Connector Type:</label>
            <input id={`component-connectortype-${comp.id}`} type="text" value={componentEditor.connectorType || ''} onChange={(e) => setComponentEditor({ ...componentEditor, connectorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., USB-A, HDMI" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-gender-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Gender:</label>
            <select id={`component-gender-${comp.id}`} value={componentEditor.gender || 'N/A'} onChange={(e) => setComponentEditor({ ...componentEditor, gender: e.target.value as 'Male' | 'Female' | 'N/A' })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="N/A">N/A</option>
            </select>
          </div>
        </>
      )}

      {/* Jumper */}
      {comp.componentType === 'Jumper' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-positions-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Positions:</label>
            <input id={`component-positions-${comp.id}`} type="number" min="2" value={componentEditor.positions || 3} onChange={(e) => setComponentEditor({ ...componentEditor, positions: parseInt(e.target.value) || 3 })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} />
          </div>
        </>
      )}

      {/* Speaker */}
      {comp.componentType === 'Speaker' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-impedance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Impedance:</label>
            <input id={`component-impedance-${comp.id}`} type="text" value={componentEditor.impedance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, impedance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 8" />
            <select value={componentEditor.impedanceUnit || getDefaultUnit('impedance')} onChange={(e) => setComponentEditor({ ...componentEditor, impedanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('impedance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
              <option value="1/20">1/20 W</option>
              <option value="1/16">1/16 W</option>
              <option value="1/10">1/10 W</option>
              <option value="1/8">1/8 W</option>
              <option value="1/4">1/4 W</option>
              <option value="1/2">1/2 W</option>
              <option value="1">1 W</option>
              <option value="2">2 W</option>
              <option value="3">3 W</option>
              <option value="5">5 W</option>
              <option value="10">10 W</option>
              <option value="25">25 W</option>
              <option value="50">50 W</option>
              <option value="100">100 W</option>
            </select>
          </div>
        </>
      )}

      {/* PowerSupply */}
      {comp.componentType === 'PowerSupply' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-inputvoltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Input Voltage:</label>
            <input id={`component-inputvoltage-${comp.id}`} type="text" value={componentEditor.inputVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, inputVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 120" />
            <select value={componentEditor.inputVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, inputVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-outputvoltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Output Voltage:</label>
            <input id={`component-outputvoltage-${comp.id}`} type="text" value={componentEditor.outputVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, outputVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.outputVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, outputVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Transistor */}
      {comp.componentType === 'Transistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-transistortype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Transistor Type:</label>
            <select id={`component-transistortype-${comp.id}`} value={componentEditor.transistorType || 'BJT'} onChange={(e) => setComponentEditor({ ...componentEditor, transistorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="BJT">BJT (Bipolar Junction Transistor)</option>
              <option value="FET">FET (Field Effect Transistor)</option>
              <option value="MOSFET">MOSFET</option>
              <option value="IGBT">IGBT</option>
              <option value="JFET">JFET</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-polarity-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Polarity:</label>
            <select id={`component-polarity-${comp.id}`} value={componentEditor.polarity || 'NPN'} onChange={(e) => setComponentEditor({ ...componentEditor, polarity: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="NPN">NPN</option>
              <option value="PNP">PNP</option>
              <option value="N-Channel">N-Channel</option>
              <option value="P-Channel">P-Channel</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* ResistorNetwork */}
      {comp.componentType === 'ResistorNetwork' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-configuration-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Configuration:</label>
            <input id={`component-configuration-${comp.id}`} type="text" value={componentEditor.configuration || ''} onChange={(e) => setComponentEditor({ ...componentEditor, configuration: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., Isolated, Bussed" />
          </div>
        </>
      )}

      {/* Thermistor */}
      {comp.componentType === 'Thermistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-thermistortype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Thermistor Type:</label>
            <select id={`component-thermistortype-${comp.id}`} value={componentEditor.thermistorType || 'NTC'} onChange={(e) => setComponentEditor({ ...componentEditor, thermistorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="NTC">NTC (Negative Temperature Coefficient)</option>
              <option value="PTC">PTC (Positive Temperature Coefficient)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-beta-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Beta (β):</label>
            <input id={`component-beta-${comp.id}`} type="text" value={componentEditor.beta || ''} onChange={(e) => setComponentEditor({ ...componentEditor, beta: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 3950" />
          </div>
        </>
      )}

      {/* Transformer */}
      {comp.componentType === 'Transformer' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-primaryvoltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Primary Voltage:</label>
            <input id={`component-primaryvoltage-${comp.id}`} type="text" value={componentEditor.primaryVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, primaryVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 120" />
            <select value={componentEditor.primaryVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, primaryVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-secondaryvoltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Secondary Voltage:</label>
            <input id={`component-secondaryvoltage-${comp.id}`} type="text" value={componentEditor.secondaryVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, secondaryVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.secondaryVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, secondaryVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
              <option value="1/20">1/20 W</option>
              <option value="1/16">1/16 W</option>
              <option value="1/10">1/10 W</option>
              <option value="1/8">1/8 W</option>
              <option value="1/4">1/4 W</option>
              <option value="1/2">1/2 W</option>
              <option value="1">1 W</option>
              <option value="2">2 W</option>
              <option value="3">3 W</option>
              <option value="5">5 W</option>
              <option value="10">10 W</option>
              <option value="25">25 W</option>
              <option value="50">50 W</option>
              <option value="100">100 W</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-turns-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Turns Ratio:</label>
            <input id={`component-turns-${comp.id}`} type="text" value={componentEditor.turns || ''} onChange={(e) => setComponentEditor({ ...componentEditor, turns: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 10:1" />
          </div>
        </>
      )}

      {/* TestPoint */}
      {comp.componentType === 'TestPoint' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-signal-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Signal:</label>
            <input id={`component-signal-${comp.id}`} type="text" value={componentEditor.signal || ''} onChange={(e) => setComponentEditor({ ...componentEditor, signal: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., VCC, GND, CLK" />
          </div>
        </>
      )}

      {/* IntegratedCircuit - special handling, IC Type and Datasheet are shown after main fields */}
      {/* For Semiconductor with dynamic fields, render them first, then datasheet */}
      {(comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') && (
        <>
          {/* For semiconductors with fields, render dynamic fields first */}
          {isSemiconductor && fields && fields.length > 0 && (() => {
            // Re-render dynamic fields for semiconductor (they weren't returned above)
            const getFieldWidth = (fieldName: string, fieldType: string, hasUnits: boolean): string => {
              if (hasUnits) return '80px';
              if (fieldName === 'partNumber' || fieldName === 'manufacturer') return '150px';
              if (fieldName === 'description' || fieldName === 'operatingTemperature') return '180px';
              if (fieldType === 'string' && !fieldName.includes('Unit')) return '150px';
              return '120px';
            };
            const renderField = (field: ComponentFieldDefinition) => {
              if (field.name === 'datasheet') {
                return null; // Skip - will be rendered in the datasheet section below
              }
              // Skip Description - it's rendered above Notes in ComponentEditor
              if (field.name === 'description') {
                return null;
              }
              // Skip Operating Temperature - it's rendered after Notes in ComponentEditor
              if (field.name === 'operatingTemperature') {
                return null;
              }
              // Skip Manufacturer and Part Number for ICs - they're rendered in IC Properties section
              if (isSemiconductor && (field.name === 'manufacturer' || field.name === 'partNumber')) {
                return null;
              }
              // Special handling for IC Type - render as dropdown
              if (field.name === 'icType' || (isSemiconductor && !field.name)) {
                // IC Type is handled separately below
                return null;
              }
              const valueKey = field.name;
              const unitKey = `${field.name}Unit`;
              const value = (componentEditor as any)[valueKey] ?? (comp as any)[valueKey] ?? field.defaultValue ?? '';
              const unit = (componentEditor as any)[unitKey] ?? (comp as any)[unitKey] ?? (field.units && field.defaultUnit ? field.defaultUnit : '');
              const onValueChange = (val: string) => {
                setComponentEditor({ ...componentEditor, [valueKey]: val });
              };
              const onUnitChange = (val: string) => {
                setComponentEditor({ ...componentEditor, [unitKey]: val });
              };
              const hasUnits = Boolean(field.units && field.units.length > 0);
              const fieldWidth = getFieldWidth(field.name, field.type, hasUnits);
              return (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                    {field.label}:
                  </label>
                  {field.type === 'enum' ? (
                    <select
                      value={value}
                      onChange={(e) => onValueChange(e.target.value)}
                      disabled={areComponentsLocked}
                      style={{ width: fieldWidth, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}
                    >
                      {(field.enumValues || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => onValueChange(e.target.value)}
                      disabled={areComponentsLocked}
                      style={{ width: fieldWidth, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: hasUnits ? '8px' : '0' }}
                      placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ''}
                    />
                  )}
                  {hasUnits && field.units && (
                    <select
                      value={unit || field.defaultUnit || field.units[0]}
                      onChange={(e) => onUnitChange(e.target.value)}
                      disabled={areComponentsLocked}
                      style={{ width: '70px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, flexShrink: 0 }}
                    >
                      {field.units.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            };
            const renderedFields = fields.map(renderField).filter(Boolean);
            
            // Add IC Type field after manufacturer if it's a semiconductor
            const icTypeField = isSemiconductor ? (
              <div key="icType" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <label htmlFor={`component-ictype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                  IC Type:
                </label>
                <select
                  id={`component-ictype-${comp.id}`}
                  value={componentEditor.icType || 'Other'}
                  onChange={(e) => setComponentEditor({ ...componentEditor, icType: e.target.value })}
                  disabled={areComponentsLocked}
                  style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}
                >
              <option value="Op-Amp">Op-Amp</option>
              <option value="Microcontroller">Microcontroller</option>
              <option value="Microprocessor">Microprocessor</option>
              <option value="Logic">Logic</option>
              <option value="Memory">Memory</option>
              <option value="Voltage Regulator">Voltage Regulator</option>
              <option value="Timer">Timer</option>
              <option value="ADC">ADC (Analog-to-Digital)</option>
              <option value="DAC">DAC (Digital-to-Analog)</option>
              <option value="Comparator">Comparator</option>
              <option value="Transceiver">Transceiver</option>
              <option value="Driver">Driver</option>
              <option value="Amplifier">Amplifier</option>
              <option value="Other">Other</option>
            </select>
          </div>
            ) : null;
            
            // Insert IC Type after manufacturer field
            const manufacturerIndex = renderedFields.findIndex((field: any) => field?.key === 'manufacturer');
            if (manufacturerIndex >= 0 && icTypeField) {
              renderedFields.splice(manufacturerIndex + 1, 0, icTypeField);
            } else if (icTypeField) {
              // If no manufacturer field, add IC Type at the end
              renderedFields.push(icTypeField);
            }
            
            return renderedFields;
          })()}
          
          {/* IC Type and Package Type for IntegratedCircuit (not Semiconductor) */}
          {isIntegratedCircuitOnly && (
            <>
              {/* IC Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <label htmlFor={`component-ictype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                  IC Type:
                </label>
                <select
                  id={`component-ictype-${comp.id}`}
                  value={componentEditor.icType || 'Other'}
                  onChange={(e) => setComponentEditor({ ...componentEditor, icType: e.target.value })}
                  disabled={areComponentsLocked}
                  style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
                >
                  <option value="Op-Amp">Op-Amp</option>
                  <option value="Microcontroller">Microcontroller</option>
                  <option value="Microprocessor">Microprocessor</option>
                  <option value="Logic">Logic</option>
                  <option value="Memory">Memory</option>
                  <option value="Voltage Regulator">Voltage Regulator</option>
                  <option value="Timer">Timer</option>
                  <option value="ADC">ADC (Analog-to-Digital)</option>
                  <option value="DAC">DAC (Digital-to-Analog)</option>
                  <option value="Comparator">Comparator</option>
                  <option value="Transceiver">Transceiver</option>
                  <option value="Driver">Driver</option>
                  <option value="Amplifier">Amplifier</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {/* Package Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <label htmlFor={`component-packagetype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                  Package Type:
            </label>
                <select
                  id={`component-packagetype-${comp.id}`}
                  value={(componentEditor as any).packageType || ''}
                  onChange={(e) => setComponentEditor({ ...componentEditor, packageType: e.target.value })}
              disabled={areComponentsLocked}
                  style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
                >
                  <option value="">-- Select --</option>
                  <option value="DIP">DIP</option>
                  <option value="PDIP">PDIP</option>
                  <option value="SOIC">SOIC</option>
                  <option value="QFP">QFP</option>
                  <option value="LQFP">LQFP</option>
                  <option value="TQFP">TQFP</option>
                  <option value="BGA">BGA</option>
                  <option value="SSOP">SSOP</option>
                  <option value="TSOP">TSOP</option>
                  <option value="Various">Various</option>
                  <option value="Other">Other</option>
                </select>
          </div>
            </>
          )}
          
          {/* Datasheet section removed - now rendered at top of ComponentEditor */}
        </>
      )}

      {/* VacuumTube */}
      {comp.componentType === 'VacuumTube' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tubetype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tube Type:</label>
            <input id={`component-tubetype-${comp.id}`} type="text" value={componentEditor.tubeType || ''} onChange={(e) => setComponentEditor({ ...componentEditor, tubeType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 12AX7, 6L6" />
          </div>
        </>
      )}

      {/* VariableResistor */}
      {comp.componentType === 'VariableResistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-vrtype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>VR Type:</label>
            <select id={`component-vrtype-${comp.id}`} value={componentEditor.vrType || 'Potentiometer'} onChange={(e) => setComponentEditor({ ...componentEditor, vrType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Potentiometer">Potentiometer</option>
              <option value="Rheostat">Rheostat</option>
              <option value="Trimmer">Trimmer</option>
              <option value="Varistor">Varistor</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
              <option value="1/20">1/20 W</option>
              <option value="1/16">1/16 W</option>
              <option value="1/10">1/10 W</option>
              <option value="1/8">1/8 W</option>
              <option value="1/4">1/4 W</option>
              <option value="1/2">1/2 W</option>
              <option value="1">1 W</option>
              <option value="2">2 W</option>
              <option value="3">3 W</option>
              <option value="5">5 W</option>
              <option value="10">10 W</option>
              <option value="25">25 W</option>
              <option value="50">50 W</option>
              <option value="100">100 W</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-taper-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Taper:</label>
            <select id={`component-taper-${comp.id}`} value={componentEditor.taper || 'Linear'} onChange={(e) => setComponentEditor({ ...componentEditor, taper: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Linear">Linear</option>
              <option value="Logarithmic">Logarithmic</option>
              <option value="Audio">Audio</option>
            </select>
          </div>
        </>
      )}

      {/* Crystal */}
      {comp.componentType === 'Crystal' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-frequency-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Frequency:</label>
            <input id={`component-frequency-${comp.id}`} type="text" value={componentEditor.frequency || ''} onChange={(e) => setComponentEditor({ ...componentEditor, frequency: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 16.000 MHz" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-loadcapacitance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Load Capacitance:</label>
            <input id={`component-loadcapacitance-${comp.id}`} type="text" value={componentEditor.loadCapacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, loadCapacitance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 18pF" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±10ppm'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="±10ppm">±10ppm</option>
              <option value="±20ppm">±20ppm</option>
              <option value="±30ppm">±30ppm</option>
              <option value="±50ppm">±50ppm</option>
              <option value="±100ppm">±100ppm</option>
            </select>
          </div>
        </>
      )}

      {/* GenericComponent */}
      {comp.componentType === 'GenericComponent' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-generictype-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Type:</label>
            <select id={`component-generictype-${comp.id}`} value={(comp as any).genericType || 'Attenuator'} onChange={(e) => setComponentEditor({ ...componentEditor, genericType: e.target.value as 'Attenuator' | 'CircuitBreaker' | 'Thermocouple' | 'Tuner' })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Attenuator">Attenuator</option>
              <option value="CircuitBreaker">Circuit Breaker</option>
              <option value="Thermocouple">Thermocouple</option>
              <option value="Tuner">Tuner</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          {(comp as any).genericType === 'Tuner' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor={`component-frequency-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Frequency:</label>
              <input id={`component-frequency-${comp.id}`} type="text" value={componentEditor.frequency || ''} onChange={(e) => setComponentEditor({ ...componentEditor, frequency: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 100MHz" />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <input id={`component-power-${comp.id}`} type="text" value={componentEditor.power || ''} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 1W" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-model-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Model:</label>
            <input id={`component-model-${comp.id}`} type="text" value={componentEditor.model || ''} onChange={(e) => setComponentEditor({ ...componentEditor, model: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="Part number or model" />
          </div>
        </>
      )}

    </>
  );
};

