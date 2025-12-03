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
 * ComponentTypeFields component
 * Renders type-specific property fields for components
 */

import React from 'react';
import type { PCBComponent } from '../../types';
import { getPropertyUnits, getDefaultUnit } from '../../constants';

export interface ComponentTypeFieldsProps {
  component: PCBComponent;
  componentEditor: any;
  setComponentEditor: (editor: any) => void;
  areComponentsLocked: boolean;
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  setComponentsTop: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  setComponentsBottom: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
}

export const ComponentTypeFields: React.FC<ComponentTypeFieldsProps> = ({
  component: comp,
  componentEditor,
  setComponentEditor,
  areComponentsLocked,
  componentsTop,
  componentsBottom,
  setComponentsTop,
  setComponentsBottom,
}) => {
  return (
    <>
      {/* Resistor */}
      {comp.componentType === 'Resistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
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
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±5%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-capacitance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacitance:</label>
            <input id={`component-capacitance-${comp.id}`} type="text" value={componentEditor.capacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacitance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.capacitanceUnit || getDefaultUnit('capacitance')} onChange={(e) => setComponentEditor({ ...componentEditor, capacitanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('capacitance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-dielectric-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Dielectric:</label>
            <select id={`component-dielectric-${comp.id}`} value={componentEditor.dielectric || 'Ceramic'} onChange={(e) => setComponentEditor({ ...componentEditor, dielectric: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±10%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-capacitance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacitance:</label>
            <input id={`component-capacitance-${comp.id}`} type="text" value={componentEditor.capacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacitance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.capacitanceUnit || getDefaultUnit('capacitance')} onChange={(e) => setComponentEditor({ ...componentEditor, capacitanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('capacitance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-filmtype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Film Type:</label>
            <select id={`component-filmtype-${comp.id}`} value={componentEditor.filmType || 'Polyester'} onChange={(e) => setComponentEditor({ ...componentEditor, filmType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±10%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-capacitance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacitance:</label>
            <input id={`component-capacitance-${comp.id}`} type="text" value={componentEditor.capacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacitance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.capacitanceUnit || 'µF'} onChange={(e) => setComponentEditor({ ...componentEditor, capacitanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              <option value="pF">pF</option>
              <option value="nF">nF</option>
              <option value="µF">µF</option>
              <option value="mF">mF</option>
              <option value="F">F</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 25" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±20%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}>
              <option value="±0.5%">±0.5%</option>
              <option value="±1%">±1%</option>
              <option value="±2%">±2%</option>
              <option value="±5%">±5%</option>
              <option value="±10%">±10%</option>
              <option value="±20%">±20%</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-polarity-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Polarity:</label>
            <select id={`component-polarity-${comp.id}`} value={componentEditor.polarityCapacitor || (comp as any).polarity || 'Positive'} onChange={(e) => setComponentEditor({ ...componentEditor, polarityCapacitor: e.target.value as 'Positive' | 'Negative' })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
            </select>
          </div>
        </>
      )}

      {/* Inductor */}
      {comp.componentType === 'Inductor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-inductance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Inductance:</label>
            <input id={`component-inductance-${comp.id}`} type="text" value={componentEditor.inductance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, inductance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.inductanceUnit || getDefaultUnit('inductance')} onChange={(e) => setComponentEditor({ ...componentEditor, inductanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('inductance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>DC Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.resistanceUnit || 'Ω'} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-diodetype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Diode Type:</label>
            <select id={`component-diodetype-${comp.id}`} value={componentEditor.diodeType || 'Standard'} onChange={(e) => setComponentEditor({ ...componentEditor, diodeType: e.target.value as 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Other' })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Standard">Standard</option>
              <option value="Zener">Zener</option>
              <option value="LED">LED</option>
              <option value="Schottky">Schottky</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {componentEditor.diodeType === 'LED' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor={`component-ledcolor-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>LED Color:</label>
              <select id={`component-ledcolor-${comp.id}`} value={componentEditor.ledColor || ''} onChange={(e) => setComponentEditor({ ...componentEditor, ledColor: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 3.7" />
            <select value={componentEditor.voltageUnit || 'V'} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-capacity-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Capacity:</label>
            <input id={`component-capacity-${comp.id}`} type="text" value={componentEditor.capacity || ''} onChange={(e) => setComponentEditor({ ...componentEditor, capacity: e.target.value })} disabled={areComponentsLocked} style={{ width: '120px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 2000mAh" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-chemistry-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Chemistry:</label>
            <select id={`component-chemistry-${comp.id}`} value={componentEditor.chemistry || 'Li-ion'} onChange={(e) => setComponentEditor({ ...componentEditor, chemistry: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 5" />
            <select value={componentEditor.currentUnit || 'A'} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 250" />
            <select value={componentEditor.voltageUnit || 'V'} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-fusetype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Fuse Type:</label>
            <select id={`component-fusetype-${comp.id}`} value={componentEditor.fuseType || 'Fast-blow'} onChange={(e) => setComponentEditor({ ...componentEditor, fuseType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-coilvoltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Coil Voltage:</label>
            <input id={`component-coilvoltage-${comp.id}`} type="text" value={componentEditor.coilVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, coilVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.coilVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, coilVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-contacttype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Contact Type:</label>
            <select id={`component-contacttype-${comp.id}`} value={componentEditor.contactType || 'SPST'} onChange={(e) => setComponentEditor({ ...componentEditor, contactType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="SPST">SPST (Single Pole Single Throw)</option>
              <option value="SPDT">SPDT (Single Pole Double Throw)</option>
              <option value="DPST">DPST (Double Pole Single Throw)</option>
              <option value="DPDT">DPDT (Double Pole Double Throw)</option>
              <option value="3PDT">3PDT (3 Pole Double Throw)</option>
              <option value="4PDT">4PDT (4 Pole Double Throw)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-motortype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Motor Type:</label>
            <select id={`component-motortype-${comp.id}`} value={componentEditor.motorType || 'DC'} onChange={(e) => setComponentEditor({ ...componentEditor, motorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="DC">DC Motor</option>
              <option value="Stepper">Stepper Motor</option>
              <option value="Servo">Servo Motor</option>
              <option value="Brushless">Brushless DC</option>
              <option value="AC">AC Motor</option>
              <option value="Synchronous">Synchronous</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-switchtype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Switch Type:</label>
            <select id={`component-switchtype-${comp.id}`} value={componentEditor.switchType || 'Toggle'} onChange={(e) => setComponentEditor({ ...componentEditor, switchType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 5" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('current').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 250" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-impedance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Impedance:</label>
            <input id={`component-impedance-${comp.id}`} type="text" value={componentEditor.impedance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, impedance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 100" />
            <select value={componentEditor.impedanceUnit || getDefaultUnit('impedance')} onChange={(e) => setComponentEditor({ ...componentEditor, impedanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('impedance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-connectortype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Connector Type:</label>
            <input id={`component-connectortype-${comp.id}`} type="text" value={componentEditor.connectorType || ''} onChange={(e) => setComponentEditor({ ...componentEditor, connectorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., USB-A, HDMI" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-gender-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Gender:</label>
            <select id={`component-gender-${comp.id}`} value={componentEditor.gender || 'N/A'} onChange={(e) => setComponentEditor({ ...componentEditor, gender: e.target.value as 'Male' | 'Female' | 'N/A' })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-positions-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Positions:</label>
            <input id={`component-positions-${comp.id}`} type="number" min="2" value={componentEditor.positions || 3} onChange={(e) => setComponentEditor({ ...componentEditor, positions: parseInt(e.target.value) || 3 })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} />
          </div>
        </>
      )}

      {/* Speaker */}
      {comp.componentType === 'Speaker' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-impedance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Impedance:</label>
            <input id={`component-impedance-${comp.id}`} type="text" value={componentEditor.impedance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, impedance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 8" />
            <select value={componentEditor.impedanceUnit || getDefaultUnit('impedance')} onChange={(e) => setComponentEditor({ ...componentEditor, impedanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('impedance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
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
            <label htmlFor={`component-inputvoltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Input Voltage:</label>
            <input id={`component-inputvoltage-${comp.id}`} type="text" value={componentEditor.inputVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, inputVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 120" />
            <select value={componentEditor.inputVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, inputVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-outputvoltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Output Voltage:</label>
            <input id={`component-outputvoltage-${comp.id}`} type="text" value={componentEditor.outputVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, outputVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.outputVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, outputVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-transistortype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Transistor Type:</label>
            <select id={`component-transistortype-${comp.id}`} value={componentEditor.transistorType || 'BJT'} onChange={(e) => setComponentEditor({ ...componentEditor, transistorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="BJT">BJT (Bipolar Junction Transistor)</option>
              <option value="FET">FET (Field Effect Transistor)</option>
              <option value="MOSFET">MOSFET</option>
              <option value="IGBT">IGBT</option>
              <option value="JFET">JFET</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-polarity-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Polarity:</label>
            <select id={`component-polarity-${comp.id}`} value={componentEditor.polarity || 'NPN'} onChange={(e) => setComponentEditor({ ...componentEditor, polarity: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="NPN">NPN</option>
              <option value="PNP">PNP</option>
              <option value="N-Channel">N-Channel</option>
              <option value="P-Channel">P-Channel</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 50" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-current-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Current:</label>
            <input id={`component-current-${comp.id}`} type="text" value={componentEditor.current || ''} onChange={(e) => setComponentEditor({ ...componentEditor, current: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 1" />
            <select value={componentEditor.currentUnit || getDefaultUnit('current')} onChange={(e) => setComponentEditor({ ...componentEditor, currentUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
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
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-configuration-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Configuration:</label>
            <input id={`component-configuration-${comp.id}`} type="text" value={componentEditor.configuration || ''} onChange={(e) => setComponentEditor({ ...componentEditor, configuration: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., Isolated, Bussed" />
          </div>
        </>
      )}

      {/* Thermistor */}
      {comp.componentType === 'Thermistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-thermistortype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Thermistor Type:</label>
            <select id={`component-thermistortype-${comp.id}`} value={componentEditor.thermistorType || 'NTC'} onChange={(e) => setComponentEditor({ ...componentEditor, thermistorType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="NTC">NTC (Negative Temperature Coefficient)</option>
              <option value="PTC">PTC (Positive Temperature Coefficient)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-beta-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Beta (β):</label>
            <input id={`component-beta-${comp.id}`} type="text" value={componentEditor.beta || ''} onChange={(e) => setComponentEditor({ ...componentEditor, beta: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 3950" />
          </div>
        </>
      )}

      {/* Transformer */}
      {comp.componentType === 'Transformer' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-primaryvoltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Primary Voltage:</label>
            <input id={`component-primaryvoltage-${comp.id}`} type="text" value={componentEditor.primaryVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, primaryVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 120" />
            <select value={componentEditor.primaryVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, primaryVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-secondaryvoltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Secondary Voltage:</label>
            <input id={`component-secondaryvoltage-${comp.id}`} type="text" value={componentEditor.secondaryVoltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, secondaryVoltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 12" />
            <select value={componentEditor.secondaryVoltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, secondaryVoltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
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
            <label htmlFor={`component-turns-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Turns Ratio:</label>
            <input id={`component-turns-${comp.id}`} type="text" value={componentEditor.turns || ''} onChange={(e) => setComponentEditor({ ...componentEditor, turns: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 10:1" />
          </div>
        </>
      )}

      {/* TestPoint */}
      {comp.componentType === 'TestPoint' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-signal-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Signal:</label>
            <input id={`component-signal-${comp.id}`} type="text" value={componentEditor.signal || ''} onChange={(e) => setComponentEditor({ ...componentEditor, signal: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., VCC, GND, CLK" />
          </div>
        </>
      )}

      {/* IntegratedCircuit - special handling, IC Type and Datasheet are shown after main fields */}
      {comp.componentType === 'IntegratedCircuit' && (
        <>
          <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0', fontSize: '9px', fontWeight: 600, color: '#666' }}>IC Properties:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-ictype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>IC Type:</label>
            <select id={`component-ictype-${comp.id}`} value={componentEditor.icType || 'Op-Amp'} onChange={(e) => setComponentEditor({ ...componentEditor, icType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-datasheet-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Datasheet:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <input id={`component-datasheet-${comp.id}`} type="text" value={componentEditor.datasheet || ''} onChange={(e) => setComponentEditor({ ...componentEditor, datasheet: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="URL" />
              {componentEditor.datasheet && componentEditor.datasheet.trim() && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = componentEditor.datasheet.trim();
                    // Ensure URL has a protocol
                    const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`;
                    window.open(urlWithProtocol, '_blank', 'noopener,noreferrer');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: areComponentsLocked ? 0.4 : 1,
                    flexShrink: 0,
                  }}
                  title="Open URL in new tab"
                  disabled={areComponentsLocked}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4a9eff' }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-pincount-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
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
              style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}
            />
          </div>
        </>
      )}

      {/* VacuumTube */}
      {comp.componentType === 'VacuumTube' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tubetype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tube Type:</label>
            <input id={`component-tubetype-${comp.id}`} type="text" value={componentEditor.tubeType || ''} onChange={(e) => setComponentEditor({ ...componentEditor, tubeType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 12AX7, 6L6" />
          </div>
        </>
      )}

      {/* VariableResistor */}
      {comp.componentType === 'VariableResistor' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-vrtype-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>VR Type:</label>
            <select id={`component-vrtype-${comp.id}`} value={componentEditor.vrType || 'Potentiometer'} onChange={(e) => setComponentEditor({ ...componentEditor, vrType: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="Potentiometer">Potentiometer</option>
              <option value="Rheostat">Rheostat</option>
              <option value="Trimmer">Trimmer</option>
              <option value="Varistor">Varistor</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-resistance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Resistance:</label>
            <input id={`component-resistance-${comp.id}`} type="text" value={componentEditor.resistance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, resistance: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 10" />
            <select value={componentEditor.resistanceUnit || getDefaultUnit('resistance')} onChange={(e) => setComponentEditor({ ...componentEditor, resistanceUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('resistance').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
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
            <label htmlFor={`component-taper-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Taper:</label>
            <select id={`component-taper-${comp.id}`} value={componentEditor.taper || 'Linear'} onChange={(e) => setComponentEditor({ ...componentEditor, taper: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
            <label htmlFor={`component-frequency-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Frequency:</label>
            <input id={`component-frequency-${comp.id}`} type="text" value={componentEditor.frequency || ''} onChange={(e) => setComponentEditor({ ...componentEditor, frequency: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 16.000 MHz" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-loadcapacitance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Load Capacitance:</label>
            <input id={`component-loadcapacitance-${comp.id}`} type="text" value={componentEditor.loadCapacitance || ''} onChange={(e) => setComponentEditor({ ...componentEditor, loadCapacitance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }} placeholder="e.g., 18pF" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±10ppm'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
              <option value="±10ppm">±10ppm</option>
              <option value="±20ppm">±20ppm</option>
              <option value="±30ppm">±30ppm</option>
              <option value="±50ppm">±50ppm</option>
              <option value="±100ppm">±100ppm</option>
            </select>
          </div>
        </>
      )}

      {/* ZenerDiode */}
      {comp.componentType === 'ZenerDiode' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-voltage-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Zener Voltage:</label>
            <input id={`component-voltage-${comp.id}`} type="text" value={componentEditor.voltage || ''} onChange={(e) => setComponentEditor({ ...componentEditor, voltage: e.target.value })} disabled={areComponentsLocked} style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }} placeholder="e.g., 5.1" />
            <select value={componentEditor.voltageUnit || getDefaultUnit('voltage')} onChange={(e) => setComponentEditor({ ...componentEditor, voltageUnit: e.target.value })} disabled={areComponentsLocked} style={{ padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, width: '60px', marginRight: '12px' }}>
              {getPropertyUnits('voltage').map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-power-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Power:</label>
            <select id={`component-power-${comp.id}`} value={componentEditor.power || '1/4'} onChange={(e) => setComponentEditor({ ...componentEditor, power: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '12px' }}>
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
            <label htmlFor={`component-tolerance-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>Tolerance:</label>
            <select id={`component-tolerance-${comp.id}`} value={componentEditor.tolerance || '±5%'} onChange={(e) => setComponentEditor({ ...componentEditor, tolerance: e.target.value })} disabled={areComponentsLocked} style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1, marginRight: '8px' }}>
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
    </>
  );
};

