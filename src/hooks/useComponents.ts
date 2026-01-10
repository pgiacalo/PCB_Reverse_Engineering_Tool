/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

import { useState, useCallback } from 'react';
import type { PCBComponent } from '../types';
import { getDefaultUnit } from '../constants';
import { COMPONENT_LIST } from '../data/componentDesignators';
import type { ComponentDefinition } from '../data/componentDefinitions.d';
import { resolveComponentDefinition } from '../utils/componentDefinitionResolver';

/**
 * Read value and unit from component
 * Reads separate value/unit fields, or parses combined string if needed
 * Special handling for power: always stored as combined "valueW" (e.g., "1/4W", "1W")
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
  // Check if either field exists (including empty strings)
  if (component[valueField] !== undefined || component[unitField] !== undefined) {
    return {
      // Preserve empty strings explicitly - don't use || which converts empty strings to ''
      value: component[valueField] !== undefined ? String(component[valueField]) : '',
      // Preserve empty strings for units too, but default to defaultUnit if undefined
      unit: component[unitField] !== undefined ? String(component[unitField]) : defaultUnit,
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
 * Parse a value string to extract number and unit
 * Examples: "10kOhm" -> { value: "10", unit: "kOhm" }, "100" -> { value: "100", unit: "" }
 * Also handles fractional values like "1/4W" -> { value: "1/4", unit: "W" }
 */
export function parseValueWithUnit(valueStr: string | undefined): { value: string; unit: string } {
  if (!valueStr || valueStr.trim() === '') {
    return { value: '', unit: '' };
  }
  
  const trimmed = valueStr.trim();
  // Try to match fractional values (e.g., "1/4W", "1/2W") or number followed by unit
  const fractionalMatch = trimmed.match(/^([\d]+\/[\d]+)\s*([a-zA-ZOhmuW]+)?$/);
  if (fractionalMatch) {
    return { value: fractionalMatch[1], unit: fractionalMatch[2] || '' };
  }
  
  // Try to match number followed by unit (handles k, M, m, u, u, etc.)
  const match = trimmed.match(/^([\d.]+)\s*([a-zA-ZOhmuW]+)?$/);
  if (match) {
    return { value: match[1], unit: match[2] || '' };
  }
  
  // If no match, return as-is (might be just a number or custom format)
  return { value: trimmed, unit: '' };
}

/**
 * Combine value and unit into a single string
 */
export function combineValueAndUnit(value: string, unit: string): string {
  if (!value || value.trim() === '') return '';
  if (!unit || unit.trim() === '') return value.trim();
  return `${value.trim()}${unit.trim()}`;
}

/**
 * Custom hook for managing component state
 */
export function useComponents() {
  const [componentsTop, setComponentsTop] = useState<PCBComponent[]>([]);
  const [componentsBottom, setComponentsBottom] = useState<PCBComponent[]>([]);
  const [componentEditor, setComponentEditor] = useState<{
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
    orientation?: number; // 0, 90, 180, 270
    // Type-specific fields (all optional, populated based on component type)
    // Resistor / ResistorNetwork / Thermistor / VariableResistor / Speaker / Transformer
    resistance?: string;
    resistanceUnit?: string; // Ohm, kOhm, MOhm
    power?: string; // value only (e.g., "1/4", "1") - "W" is appended when saving
    tolerance?: string;
    // Capacitor
    capacitance?: string;
    capacitanceUnit?: string; // pF, nF, uF, mF, F
    voltage?: string;
    voltageUnit?: string; // V, mV, kV
    dielectric?: string;
    // Electrolytic Capacitor
    polarized?: boolean; // true if component is polarized (has positive/negative pins)
    esr?: string;
    esrUnit?: string; // unit, e.g., "mOhm"
    temperature?: string;
    // Diode
    diodeType?: 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Infrared' | 'Photodiode' | 'Other';
    current?: string;
    currentUnit?: string; // A, mA, uA
    ledColor?: string;
    // GenericComponent
    genericType?: 'Attenuator' | 'CircuitBreaker' | 'Thermocouple' | 'Tuner';
    model?: string; // part number or model
    // Battery
    capacity?: string;
    capacityUnit?: string; // unit, e.g., "mAh"
    chemistry?: string;
    // Fuse
    fuseType?: string;
    // FerriteBead
    impedance?: string;
    impedanceUnit?: string; // unit, e.g., "Ohm"
    // Connector
    connectorType?: string;
    gender?: 'Male' | 'Female' | 'N/A';
    // Jumper
    positions?: number;
    // Relay
    coilVoltage?: string;
    coilVoltageUnit?: string; // unit, e.g., "V"
    contactType?: string;
    // Inductor
    inductance?: string;
    inductanceUnit?: string; // nH, uH, mH, H
    // Speaker
    // (impedance already covered)
    // Motor
    motorType?: string;
    // PowerSupply
    inputVoltage?: string;
    inputVoltageUnit?: string; // unit, e.g., "V"
    outputVoltage?: string;
    outputVoltageUnit?: string; // unit, e.g., "V"
    // Transistor
    transistorType?: 'BJT' | 'FET' | 'MOSFET' | 'JFET' | 'Other';
    polarity?: 'NPN' | 'PNP' | 'N-Channel' | 'P-Channel';
    // ResistorNetwork
    configuration?: string;
    // Thermistor
    thermistorType?: 'NTC' | 'PTC';
    beta?: string;
    // Switch
    switchType?: string;
    // Transformer
    primaryVoltage?: string;
    primaryVoltageUnit?: string; // unit, e.g., "V"
    secondaryVoltage?: string;
    secondaryVoltageUnit?: string; // unit, e.g., "V"
    // power and powerUnit already defined above (shared with Resistor, etc.)
    turns?: string;
    // TestPoint
    signal?: string;
    // IntegratedCircuit
    description?: string;
    datasheet?: string;
    icType?: string;
    // VacuumTube
    tubeType?: string;
    // VariableResistor
    vrType?: 'Potentiometer' | 'Varistor' | 'VoltageRegulator';
    taper?: string;
    // Crystal / GenericComponent (Tuner)
    frequency?: string; // for Crystal or GenericComponent (Tuner)
    loadCapacitance?: string;
  } | null>(null);
  const [connectingPin, setConnectingPin] = useState<{ componentId: string; pinIndex: number } | null>(null);
  const [componentDialogPosition, setComponentDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDialog, setIsDraggingDialog] = useState(false);
  const [dialogDragOffset, setDialogDragOffset] = useState<{ x: number; y: number } | null>(null);

  const addComponent = useCallback((component: PCBComponent, layer: 'top' | 'bottom') => {
    if (layer === 'top') {
      setComponentsTop(prev => [...prev, component]);
    } else {
      setComponentsBottom(prev => [...prev, component]);
    }
  }, []);

  const updateComponent = useCallback((id: string, updates: Partial<PCBComponent>, layer: 'top' | 'bottom') => {
    if (layer === 'top') {
      setComponentsTop(prev => prev.map(c => c.id === id ? { ...c, ...updates } as PCBComponent : c));
    } else {
      setComponentsBottom(prev => prev.map(c => c.id === id ? { ...c, ...updates } as PCBComponent : c));
    }
  }, []);

  const removeComponent = useCallback((id: string, layer: 'top' | 'bottom') => {
    // If the component being deleted is currently being edited, close the editor
    if (componentEditor && componentEditor.id === id) {
      setComponentEditor(null);
      setConnectingPin(null);
    }
    
    if (layer === 'top') {
      setComponentsTop(prev => prev.filter(c => c.id !== id));
    } else {
      setComponentsBottom(prev => prev.filter(c => c.id !== id));
    }
  }, [componentEditor, setComponentEditor, setConnectingPin]);

  const openComponentEditor = useCallback((component: PCBComponent, layer: 'top' | 'bottom') => {
    // Validate component has all required properties before proceeding
    if (!component) {
      console.error('[openComponentEditor] Component is null or undefined');
      return;
    }
    
    if (!component.id || typeof component.id !== 'string') {
      console.error('[openComponentEditor] Component missing valid id property:', { component });
      return;
    }
    
    const componentId = component.id; // Store for use after type narrowing
    
    if (!component.componentType || typeof component.componentType !== 'string') {
      console.error('[openComponentEditor] Component missing valid componentType property:', { componentId, component });
      return;
    }
    
    const componentType = component.componentType; // Store for use after type narrowing
    
    if (typeof component.pinCount !== 'number' || component.pinCount < 0) {
      console.error('[openComponentEditor] Component missing valid pinCount property:', { componentId, componentType, pinCount: component.pinCount, component });
      return;
    }
    
    if (layer !== 'top' && layer !== 'bottom') {
      console.error('[openComponentEditor] Invalid layer parameter:', { layer, componentId: component.id });
      return;
    }
    
    // Extract abbreviation from designator if not already set
    const designator = component.designator || '';
    const abbreviation = (component as any).abbreviation || (designator.length > 0 ? designator.charAt(0).toUpperCase() : '');
    const compType = (component as any).componentType as any;

    const editor: any = {
      visible: true,
      layer,
      id: component.id,
      designator: designator,
      abbreviation: abbreviation,
      manufacturer: 'manufacturer' in component ? (component as any).manufacturer || '' : '',
      partNumber: 'partNumber' in component ? (component as any).partNumber || '' : '',
      pinCount: component.pinCount,
      x: component.x,
      y: component.y,
      orientation: component.orientation ?? 0,
      description: (component as any).description || '', // Initialize description for all components
      datasheet: (component as any).datasheet || '', // Initialize datasheet for all components (used by IntegratedCircuit)
      componentDefinitionKey: (component as any).componentDefinitionKey || '',
    };
    
    // Extract type-specific fields based on component type
    // Read type-specific fields
    if (compType === 'Resistor') {
      const r = component as any;
      // Debug: Log component values before reading
      console.log('[openComponentEditor] Resistor - component values:', {
        resistance: r.resistance,
        resistanceUnit: r.resistanceUnit,
        resistanceType: typeof r.resistance,
      });
      const resistance = readValueAndUnit(r, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      console.log('[openComponentEditor] Resistor - readValueAndUnit result:', resistance);
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      // Power is stored as combined "valueW" (e.g., "1/4W", "1W")
      const power = readValueAndUnit(r, 'power', 'powerUnit', 'W');
      editor.power = power.value || '1/4';
      editor.tolerance = r.tolerance || '+/-5%';
    } else if (compType === 'Capacitor') {
      const c = component as any;
      // Debug: Log component values before reading
      console.log('[openComponentEditor] Capacitor - component values:', {
        capacitance: c.capacitance,
        capacitanceUnit: c.capacitanceUnit,
        capacitanceType: typeof c.capacitance,
      });
      const capacitance = readValueAndUnit(c, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      console.log('[openComponentEditor] Capacitor - readValueAndUnit result:', capacitance);
      editor.capacitance = capacitance.value;
      editor.capacitanceUnit = capacitance.unit;
      const voltage = readValueAndUnit(c, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.tolerance = c.tolerance || '+/-10%';
      editor.dielectric = c.dielectric || 'Ceramic';
    } else if (compType === 'Electrolytic Capacitor') {
      const c = component as any;
      const capacitance = readValueAndUnit(c, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      editor.capacitance = capacitance.value;
      editor.capacitanceUnit = capacitance.unit;
      const voltage = readValueAndUnit(c, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.tolerance = c.tolerance || '+/-20%';
      editor.polarized = (c as any).polarized !== undefined ? (c as any).polarized : true; // Default to true for electrolytic capacitors
      const esr = readValueAndUnit(c, 'esr', 'esrUnit', getDefaultUnit('esr'));
      editor.esr = esr.value;
      editor.esrUnit = esr.unit;
      editor.temperature = c.temperature || '';
    } else if (compType === 'Film Capacitor') {
      const c = component as any;
      const capacitance = readValueAndUnit(c, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      editor.capacitance = capacitance.value;
      editor.capacitanceUnit = capacitance.unit;
      const voltage = readValueAndUnit(c, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.tolerance = c.tolerance || '+/-10%';
      editor.filmType = c.filmType || 'Polyester';
    } else if (compType === 'Diode') {
      const d = component as any;
      // Use the actual diodeType from the component (should be pre-filled from selection)
      editor.diodeType = d.diodeType || 'Standard';
      const voltage = readValueAndUnit(d, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(d, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      editor.ledColor = d.ledColor || '';
    } else if (compType === 'Battery') {
      const b = component as any;
      const voltage = readValueAndUnit(b, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const capacity = readValueAndUnit(b, 'capacity', 'capacityUnit', getDefaultUnit('capacity'));
      editor.capacity = capacity.value;
      editor.capacityUnit = capacity.unit;
      editor.chemistry = b.chemistry || 'Li-ion';
    } else if (compType === 'Fuse') {
      const f = component as any;
      const current = readValueAndUnit(f, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      const voltage = readValueAndUnit(f, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.fuseType = f.fuseType || 'Fast-blow';
    } else if (compType === 'FerriteBead') {
      const fb = component as any;
      const impedance = readValueAndUnit(fb, 'impedance', 'impedanceUnit', getDefaultUnit('impedance'));
      editor.impedance = impedance.value;
      editor.impedanceUnit = impedance.unit;
      const current = readValueAndUnit(fb, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (compType === 'Connector') {
      const conn = component as any;
      editor.connectorType = conn.connectorType || '';
      editor.gender = conn.gender || 'N/A';
    } else if (compType === 'Jumper') {
      const j = component as any;
      editor.positions = j.positions || 3;
    } else if (compType === 'Relay') {
      const r = component as any;
      const coilVoltage = readValueAndUnit(r, 'coilVoltage', 'coilVoltageUnit', getDefaultUnit('coilVoltage'));
      editor.coilVoltage = coilVoltage.value;
      editor.coilVoltageUnit = coilVoltage.unit;
      editor.contactType = r.contactType || 'SPST';
      const current = readValueAndUnit(r, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (compType === 'Inductor') {
      const i = component as any;
      const inductance = readValueAndUnit(i, 'inductance', 'inductanceUnit', getDefaultUnit('inductance'));
      editor.inductance = inductance.value;
      editor.inductanceUnit = inductance.unit;
      const current = readValueAndUnit(i, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      const resistance = readValueAndUnit(i, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
    } else if (compType === 'Speaker') {
      const s = component as any;
      const impedance = readValueAndUnit(s, 'impedance', 'impedanceUnit', getDefaultUnit('impedance'));
      editor.impedance = impedance.value;
      editor.impedanceUnit = impedance.unit;
      // Power is stored as combined "valueW" (e.g., "1/4W", "1W")
      const power = readValueAndUnit(s, 'power', 'powerUnit', 'W');
      editor.power = power.value || '1';
    } else if (compType === 'Motor') {
      const m = component as any;
      editor.motorType = m.motorType || 'DC';
      const voltage = readValueAndUnit(m, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(m, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (compType === 'PowerSupply') {
      const ps = component as any;
      const inputVoltage = readValueAndUnit(ps, 'inputVoltage', 'inputVoltageUnit', getDefaultUnit('inputVoltage'));
      editor.inputVoltage = inputVoltage.value;
      editor.inputVoltageUnit = inputVoltage.unit;
      const outputVoltage = readValueAndUnit(ps, 'outputVoltage', 'outputVoltageUnit', getDefaultUnit('outputVoltage'));
      editor.outputVoltage = outputVoltage.value;
      editor.outputVoltageUnit = outputVoltage.unit;
      const current = readValueAndUnit(ps, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (compType === 'Transistor') {
      const t = component as any;
      editor.transistorType = t.transistorType || 'BJT';
      editor.polarity = t.polarity || 'NPN';
      const voltage = readValueAndUnit(t, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(t, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (compType === 'ResistorNetwork') {
      const rn = component as any;
      const resistance = readValueAndUnit(rn, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      editor.configuration = rn.configuration || '';
    } else if (compType === 'Thermistor') {
      const t = component as any;
      const resistance = readValueAndUnit(t, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      editor.thermistorType = t.thermistorType || 'NTC';
      editor.beta = t.beta || '';
    } else if (compType === 'Switch') {
      const s = component as any;
      editor.switchType = s.switchType || 'Toggle';
      const current = readValueAndUnit(s, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      const voltage = readValueAndUnit(s, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
    } else if (compType === 'Transformer') {
      const t = component as any;
      const primaryVoltage = readValueAndUnit(t, 'primaryVoltage', 'primaryVoltageUnit', getDefaultUnit('primaryVoltage'));
      editor.primaryVoltage = primaryVoltage.value;
      editor.primaryVoltageUnit = primaryVoltage.unit;
      const secondaryVoltage = readValueAndUnit(t, 'secondaryVoltage', 'secondaryVoltageUnit', getDefaultUnit('secondaryVoltage'));
      editor.secondaryVoltage = secondaryVoltage.value;
      editor.secondaryVoltageUnit = secondaryVoltage.unit;
      const power = readValueAndUnit(t, 'power', 'powerUnit', getDefaultUnit('power'));
      editor.power = power.value || '1';
      editor.turns = t.turns || '';
    } else if (compType === 'TestPoint') {
      const tp = component as any;
      editor.signal = tp.signal || '';
    } else if (compType === 'IntegratedCircuit' || compType === 'Semiconductor') {
      // Handle both 'IntegratedCircuit' and legacy 'Semiconductor' componentType
      const ic = component as any;
      // For ICs, description should be synced with designator if description is empty
      // This ensures auto-assigned designators are properly displayed
      editor.description = ic.description || component.designator || '';
      // Use 'datasheet' field consistently (not 'datasheetUrl')
      editor.datasheet = ic.datasheet || '';
      // Restore datasheet file path (relative to project root, e.g., "datasheets/filename.pdf")
      editor.datasheetFileName = ic.datasheetFileName || undefined;
      // Restore manufacturer, part number, operating temperature, and package type
      editor.manufacturer = ic.manufacturer || '';
      editor.partNumber = ic.partNumber || '';
      (editor as any).operatingTemperature = ic.operatingTemperature || '';
      (editor as any).packageType = ic.packageType || '';
      console.log('[useComponents] Loading IC component - datasheet from component:', ic.datasheet, 'editor datasheet:', editor.datasheet, 'datasheetFileName:', ic.datasheetFileName);
      editor.icType = ic.icType || 'Op-Amp';
    } else if (compType === 'VacuumTube') {
      const vt = component as any;
      editor.tubeType = vt.tubeType || '';
    } else if (compType === 'VariableResistor') {
      const vr = component as any;
      editor.vrType = vr.vrType || 'Potentiometer';
      const resistance = readValueAndUnit(vr, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      const power = readValueAndUnit(vr, 'power', 'powerUnit', getDefaultUnit('power'));
      editor.power = power.value || '1/4';
      editor.taper = vr.taper || '';
    } else if (compType === 'Crystal') {
      const x = component as any;
      editor.frequency = x.frequency || '';
      editor.loadCapacitance = x.loadCapacitance || '';
      editor.tolerance = x.tolerance || '';
    } else if (compType === 'Diode') {
      const d = component as any;
      // Pre-fill diodeType from component's diodeType property
      editor.diodeType = d.diodeType || 'Standard';
      const voltage = readValueAndUnit(d, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(d, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      editor.ledColor = d.ledColor || '';
    } else if (compType === 'GenericComponent') {
      const gc = component as any;
      editor.genericType = gc.genericType || 'Attenuator';
      const voltage = readValueAndUnit(gc, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(gc, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      editor.power = gc.power || '';
      editor.frequency = gc.frequency || '';
      editor.model = gc.model || '';
    }
    
    // Attach component definition (resolved by stored key) for dynamic rendering
    // CRITICAL: This is essential for the Component Properties dialog to render custom fields
    let resolvedDef: ComponentDefinition | undefined = undefined;
    const defKey = (component as any).componentDefinitionKey;
    
    console.log('[openComponentEditor] Resolving definition for component:', {
      id: component.id,
      componentType: component.componentType,
      componentDefinitionKey: defKey,
      hasKey: !!defKey,
      designator: component.designator,
      // Log a sample of available keys for debugging
      sampleKeys: COMPONENT_LIST.slice(0, 5).map(d => `${d.category}:${d.subcategory}`)
    });
    
    if (defKey) {
      // Try to find definition by key first (most reliable)
      // Support both old format (category:subcategory:type) and new format (category:subcategory)
      resolvedDef = COMPONENT_LIST.find(d => {
        const newKey = `${d.category}:${d.subcategory}`;
        const oldKey = `${d.category}:${d.subcategory}:${d.type}`;
        return defKey === newKey || defKey === oldKey;
      });
      console.log('[openComponentEditor] Key-based lookup result:', {
        key: defKey,
        found: !!resolvedDef,
        foundCategory: resolvedDef?.category,
        foundSubcategory: resolvedDef?.subcategory,
        foundType: resolvedDef?.type
      });
      
      // If key lookup failed, the key might be outdated (e.g., "BJT" -> "BJT NPN")
      // We'll fall through to heuristic resolution below
    }
    
    // Fallback: Use resolveComponentDefinition if key-based lookup failed
    // This handles cases where:
    // - componentDefinitionKey is missing
    // - componentDefinitionKey is incorrect/outdated (e.g., subcategory changed)
    // - Key doesn't match any existing definition
    if (!resolvedDef) {
      resolvedDef = resolveComponentDefinition(component as any);
      console.log('[openComponentEditor] Fallback resolution result:', {
        found: !!resolvedDef,
        foundCategory: resolvedDef?.category,
        foundSubcategory: resolvedDef?.subcategory,
        foundType: resolvedDef?.type
      });
      
      // If we successfully resolved it, set the key for future use
      // CRITICAL: Always update the key if we resolved a definition (even if key existed)
      // This handles cases where the subcategory changed (e.g., "BJT" -> "BJT NPN")
      if (resolvedDef) {
        const resolvedKey = `${resolvedDef.category}:${resolvedDef.subcategory}`;
        const oldKey = (component as any).componentDefinitionKey;
        
        // Update key if it's different (handles subcategory changes)
        if (oldKey !== resolvedKey) {
          console.log('[openComponentEditor] Updating componentDefinitionKey:', {
            old: oldKey,
            new: resolvedKey,
            reason: 'Key mismatch - subcategory may have changed'
          });
        } else {
          console.log('[openComponentEditor] Setting componentDefinitionKey:', resolvedKey);
        }
        
        (component as any).componentDefinitionKey = resolvedKey;
        editor.componentDefinitionKey = resolvedKey;
        
        // CRITICAL: Update the component in state with the key so it's persisted
        // This ensures the key is saved when the component is next saved
        if (layer === 'top') {
          setComponentsTop(prev => prev.map(c => 
            c.id === component.id ? { ...c, componentDefinitionKey: resolvedKey } as any : c
          ));
        } else {
          setComponentsBottom(prev => prev.map(c => 
            c.id === component.id ? { ...c, componentDefinitionKey: resolvedKey } as any : c
          ));
        }
      }
    }
    
    if (resolvedDef) {
      editor.componentDefinition = resolvedDef;
      // Ensure componentDefinitionKey is set in editor
      if (!editor.componentDefinitionKey) {
        const finalKey = `${resolvedDef.category}:${resolvedDef.subcategory}`;
        editor.componentDefinitionKey = finalKey;
        console.log('[openComponentEditor] Set componentDefinitionKey in editor:', finalKey);
      }
      
      // Populate all dynamic fields from component data based on definition
      // This ensures all fields defined in componentDefinitions.json are loaded
      if (resolvedDef.fields && Array.isArray(resolvedDef.fields)) {
        console.log('[openComponentEditor] Populating', resolvedDef.fields.length, 'fields from definition');
        for (const field of resolvedDef.fields) {
          const valueKey = field.name;
          const unitKey = `${field.name}Unit`;
          
          // Skip special fields that are handled elsewhere
          if (valueKey === 'datasheet' || valueKey === 'description') {
            continue;
          }
          
          // Read value from component
          const value = (component as any)[valueKey];
          if (value !== undefined && value !== null && value !== '') {
            editor[valueKey] = value;
          }
          
          // Read unit if field has units
          if (field.units && field.units.length > 0) {
            const unit = (component as any)[unitKey];
            if (unit !== undefined && unit !== null && unit !== '') {
              editor[unitKey] = unit;
            } else if (field.defaultUnit) {
              editor[unitKey] = field.defaultUnit;
            }
          }
        }
      } else {
        console.warn('[openComponentEditor] Definition has no fields:', resolvedDef);
      }
    } else {
      console.error('[openComponentEditor] CRITICAL: Could not resolve component definition for component:', {
        id: component.id,
        componentType: component.componentType,
        componentDefinitionKey: defKey,
        designator: component.designator,
        allKeys: COMPONENT_LIST.map(d => `${d.category}:${d.subcategory}`).slice(0, 10)
      });
    }

    setComponentEditor(editor);
  }, [setComponentsTop, setComponentsBottom]);

  const closeComponentEditor = useCallback(() => {
    setComponentEditor(null);
    setConnectingPin(null);
  }, []);

  return {
    // State
    componentsTop,
    setComponentsTop,
    componentsBottom,
    setComponentsBottom,
    componentEditor,
    setComponentEditor,
    connectingPin,
    setConnectingPin,
    componentDialogPosition,
    setComponentDialogPosition,
    isDraggingDialog,
    setIsDraggingDialog,
    dialogDragOffset,
    setDialogDragOffset,
    
    // Actions
    addComponent,
    updateComponent,
    removeComponent,
    openComponentEditor,
    closeComponentEditor,
  };
}

