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

// ============================================================================
// Bill of Materials (BOM) Generation Utilities
// ============================================================================

import type { PCBComponent } from '../types';
import { formatComponentTypeName } from '../constants';
import { combineValueAndUnit, parseValueWithUnit } from '../hooks/useComponents';
import { getDefaultUnit } from './netlist';

/**
 * Read value and unit from component
 * Reads separate value/unit fields, or parses combined string if needed
 */
function readValueAndUnit(
  component: any,
  valueField: string,
  unitField: string,
  defaultUnit: string
): { value: string; unit: string } {
  // Special case: power is always stored as combined value+unit (e.g., "1/4W", "1W")
  if (valueField === 'power') {
    const powerValue = component[valueField] || '';
    if (typeof powerValue === 'string' && powerValue.trim() !== '') {
      // Remove trailing "W" if present
      const value = powerValue.replace(/W$/i, '').trim();
      return { value, unit: 'W' };
    }
    return { value: '', unit: 'W' };
  }
  
  // Try to read separate fields first (new format)
  if (component[valueField] !== undefined || component[unitField] !== undefined) {
    return {
      value: component[valueField] || '',
      unit: component[unitField] || defaultUnit,
    };
  }
  
  // Fallback: parse combined string if no separate fields
  const combined = component[valueField] || '';
  if (typeof combined === 'string' && combined.trim() !== '') {
    return parseValueWithUnit(combined);
  }
  
  return { value: '', unit: defaultUnit };
}

/**
 * BOM Item represents a grouped component entry with quantity
 */
export interface BOMItem {
  componentType: string;
  value: string;
  quantity: number;
  designators: string[];
  packageType?: string;
  manufacturer?: string;
  partNumber?: string;
  description?: string;
  notes?: string | null;
  layer: 'top' | 'bottom' | 'both';
}

/**
 * BOM Data structure
 */
export interface BOMData {
  version: string;
  exportedAt: string;
  projectName?: string;
  totalComponents: number;
  uniqueComponents: number;
  items: BOMItem[];
}

/**
 * Get component value string for BOM
 */
function getComponentValue(comp: PCBComponent): string {
  // For Resistor: use resistance with unit
  if (comp.componentType === 'Resistor' && 'resistance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Capacitor: use capacitance with unit
  if (comp.componentType === 'Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Electrolytic Capacitor: use capacitance with unit
  if (comp.componentType === 'Electrolytic Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Film Capacitor: use capacitance with unit
  if (comp.componentType === 'Film Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Inductor: use inductance with unit
  if (comp.componentType === 'Inductor' && 'inductance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'inductance', 'inductanceUnit', getDefaultUnit('inductance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For ICs, Transistors, Diodes, and other active components: use partNumber or partName
  const partName = (comp as any).partName?.trim();
  if (partName && partName !== '') {
    return partName;
  }
  
  const partNumber = (comp as any).partNumber?.trim();
  if (partNumber && partNumber !== '') {
    return partNumber;
  }
  
  // Fallback to componentType
  return formatComponentTypeName(comp.componentType);
}

/**
 * Generate BOM data from components
 */
export function generateBOM(
  componentsTop: PCBComponent[],
  componentsBottom: PCBComponent[],
  projectName?: string
): BOMData {
  const allComponents = [...componentsTop, ...componentsBottom];
  const totalComponents = allComponents.length;
  
  // Group components by type and value
  const bomMap = new Map<string, BOMItem>();
  
  for (const comp of allComponents) {
    const componentType = formatComponentTypeName(comp.componentType);
    const value = getComponentValue(comp);
    const key = `${componentType}|${value}`;
    
    if (!bomMap.has(key)) {
      // Determine layer(s)
      const hasTop = componentsTop.some(c => c.id === comp.id);
      const hasBottom = componentsBottom.some(c => c.id === comp.id);
      const layer = hasTop && hasBottom ? 'both' : (hasTop ? 'top' : 'bottom');
      
      bomMap.set(key, {
        componentType,
        value,
        quantity: 0,
        designators: [],
        packageType: comp.packageType,
        manufacturer: (comp as any).manufacturer,
        partNumber: (comp as any).partNumber,
        description: comp.description,
        notes: comp.notes,
        layer,
      });
    }
    
    const item = bomMap.get(key)!;
    item.quantity++;
    if (comp.designator && comp.designator.trim() !== '') {
      item.designators.push(comp.designator.trim());
    }
  }
  
  // Convert map to sorted array
  const items = Array.from(bomMap.values()).sort((a, b) => {
    // Sort by component type first, then by value
    if (a.componentType !== b.componentType) {
      return a.componentType.localeCompare(b.componentType);
    }
    return a.value.localeCompare(b.value);
  });
  
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projectName,
    totalComponents,
    uniqueComponents: items.length,
    items,
  };
}

