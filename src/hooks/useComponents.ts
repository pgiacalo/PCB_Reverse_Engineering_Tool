import { useState, useCallback } from 'react';
import type { PCBComponent } from '../types';
import { getDefaultUnit } from '../constants';

/**
 * Read value and unit from component, with backward compatibility for old combined format
 * First tries to read separate value/unit fields, falls back to parsing combined string
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
  if (component[valueField] !== undefined || component[unitField] !== undefined) {
    return {
      value: component[valueField] || '',
      unit: component[unitField] || defaultUnit,
    };
  }
  
  // Fallback: parse combined string (backward compatibility for old projects)
  const combined = component[valueField] || '';
  if (typeof combined === 'string' && combined.trim() !== '') {
    return parseValueWithUnit(combined);
  }
  
  return { value: '', unit: defaultUnit };
}

/**
 * Parse a value string to extract number and unit (for backward compatibility only)
 * Examples: "10kΩ" -> { value: "10", unit: "kΩ" }, "100" -> { value: "100", unit: "" }
 * Also handles fractional values like "1/4W" -> { value: "1/4", unit: "W" }
 */
export function parseValueWithUnit(valueStr: string | undefined): { value: string; unit: string } {
  if (!valueStr || valueStr.trim() === '') {
    return { value: '', unit: '' };
  }
  
  const trimmed = valueStr.trim();
  // Try to match fractional values (e.g., "1/4W", "1/2W") or number followed by unit
  const fractionalMatch = trimmed.match(/^([\d]+\/[\d]+)\s*([a-zA-ZΩµμuW]+)?$/);
  if (fractionalMatch) {
    return { value: fractionalMatch[1], unit: fractionalMatch[2] || '' };
  }
  
  // Try to match number followed by unit (handles k, M, m, µ, u, etc.)
  const match = trimmed.match(/^([\d.]+)\s*([a-zA-ZΩµμuW]+)?$/);
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
    // Resistor / ResistorNetwork / Thermistor / VariableResistor / Speaker / Transformer / ZenerDiode
    resistance?: string;
    resistanceUnit?: string; // Ω, kΩ, MΩ
    power?: string; // value only (e.g., "1/4", "1") - "W" is appended when saving
    tolerance?: string;
    // Capacitor
    capacitance?: string;
    capacitanceUnit?: string; // pF, nF, µF, mF, F
    voltage?: string;
    voltageUnit?: string; // V, mV, kV
    dielectric?: string;
    // Electrolytic Capacitor
    polarityCapacitor?: 'Positive' | 'Negative'; // renamed to avoid conflict with Transistor polarity
    esr?: string;
    esrUnit?: string; // unit, e.g., "mΩ"
    temperature?: string;
    // Diode
    diodeType?: 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Other';
    current?: string;
    currentUnit?: string; // A, mA, µA
    ledColor?: string;
    // Battery
    capacity?: string;
    capacityUnit?: string; // unit, e.g., "mAh"
    chemistry?: string;
    // Fuse
    fuseType?: string;
    // FerriteBead
    impedance?: string;
    impedanceUnit?: string; // unit, e.g., "Ω"
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
    inductanceUnit?: string; // nH, µH, mH, H
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
    // Crystal
    frequency?: string;
    loadCapacitance?: string;
    // ZenerDiode
    // (voltage, power, tolerance already covered)
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
    if (layer === 'top') {
      setComponentsTop(prev => prev.filter(c => c.id !== id));
    } else {
      setComponentsBottom(prev => prev.filter(c => c.id !== id));
    }
  }, []);

  const openComponentEditor = useCallback((component: PCBComponent, layer: 'top' | 'bottom') => {
    // Extract abbreviation from designator if not already set
    const designator = component.designator || '';
    const abbreviation = (component as any).abbreviation || (designator.length > 0 ? designator.charAt(0).toUpperCase() : '');
    
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
    };
    
    // Extract type-specific fields based on component type
    // Read separate value/unit fields directly (with backward compatibility)
    if (component.componentType === 'Resistor') {
      const r = component as any;
      const resistance = readValueAndUnit(r, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      // Power is stored as combined "valueW" (e.g., "1/4W", "1W")
      const power = readValueAndUnit(r, 'power', 'powerUnit', 'W');
      editor.power = power.value || '1/4';
      editor.tolerance = r.tolerance || '±5%';
    } else if (component.componentType === 'Capacitor') {
      const c = component as any;
      const capacitance = readValueAndUnit(c, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      editor.capacitance = capacitance.value;
      editor.capacitanceUnit = capacitance.unit;
      const voltage = readValueAndUnit(c, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.tolerance = c.tolerance || '±10%';
      editor.dielectric = c.dielectric || 'Ceramic';
    } else if (component.componentType === 'Electrolytic Capacitor') {
      const c = component as any;
      const capacitance = readValueAndUnit(c, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      editor.capacitance = capacitance.value;
      editor.capacitanceUnit = capacitance.unit;
      const voltage = readValueAndUnit(c, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.tolerance = c.tolerance || '±20%';
      editor.polarityCapacitor = c.polarity || 'Positive';
      const esr = readValueAndUnit(c, 'esr', 'esrUnit', getDefaultUnit('esr'));
      editor.esr = esr.value;
      editor.esrUnit = esr.unit;
      editor.temperature = c.temperature || '';
    } else if (component.componentType === 'Diode') {
      const d = component as any;
      editor.diodeType = d.diodeType || 'Standard';
      const voltage = readValueAndUnit(d, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(d, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      editor.ledColor = d.ledColor || '';
    } else if (component.componentType === 'Battery') {
      const b = component as any;
      const voltage = readValueAndUnit(b, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const capacity = readValueAndUnit(b, 'capacity', 'capacityUnit', getDefaultUnit('capacity'));
      editor.capacity = capacity.value;
      editor.capacityUnit = capacity.unit;
      editor.chemistry = b.chemistry || 'Li-ion';
    } else if (component.componentType === 'Fuse') {
      const f = component as any;
      const current = readValueAndUnit(f, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      const voltage = readValueAndUnit(f, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      editor.fuseType = f.fuseType || 'Fast-blow';
    } else if (component.componentType === 'FerriteBead') {
      const fb = component as any;
      const impedance = readValueAndUnit(fb, 'impedance', 'impedanceUnit', getDefaultUnit('impedance'));
      editor.impedance = impedance.value;
      editor.impedanceUnit = impedance.unit;
      const current = readValueAndUnit(fb, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (component.componentType === 'Connector') {
      const conn = component as any;
      editor.connectorType = conn.connectorType || '';
      editor.gender = conn.gender || 'N/A';
    } else if (component.componentType === 'Jumper') {
      const j = component as any;
      editor.positions = j.positions || 3;
    } else if (component.componentType === 'Relay') {
      const r = component as any;
      const coilVoltage = readValueAndUnit(r, 'coilVoltage', 'coilVoltageUnit', getDefaultUnit('coilVoltage'));
      editor.coilVoltage = coilVoltage.value;
      editor.coilVoltageUnit = coilVoltage.unit;
      editor.contactType = r.contactType || 'SPST';
      const current = readValueAndUnit(r, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (component.componentType === 'Inductor') {
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
    } else if (component.componentType === 'Speaker') {
      const s = component as any;
      const impedance = readValueAndUnit(s, 'impedance', 'impedanceUnit', getDefaultUnit('impedance'));
      editor.impedance = impedance.value;
      editor.impedanceUnit = impedance.unit;
      // Power is stored as combined "valueW" (e.g., "1/4W", "1W")
      const power = readValueAndUnit(s, 'power', 'powerUnit', 'W');
      editor.power = power.value || '1';
    } else if (component.componentType === 'Motor') {
      const m = component as any;
      editor.motorType = m.motorType || 'DC';
      const voltage = readValueAndUnit(m, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(m, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (component.componentType === 'PowerSupply') {
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
    } else if (component.componentType === 'Transistor') {
      const t = component as any;
      editor.transistorType = t.transistorType || 'BJT';
      editor.polarity = t.polarity || 'NPN';
      const voltage = readValueAndUnit(t, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const current = readValueAndUnit(t, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
    } else if (component.componentType === 'ResistorNetwork') {
      const rn = component as any;
      const resistance = readValueAndUnit(rn, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      editor.configuration = rn.configuration || '';
    } else if (component.componentType === 'Thermistor') {
      const t = component as any;
      const resistance = readValueAndUnit(t, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      editor.thermistorType = t.thermistorType || 'NTC';
      editor.beta = t.beta || '';
    } else if (component.componentType === 'Switch') {
      const s = component as any;
      editor.switchType = s.switchType || 'Toggle';
      const current = readValueAndUnit(s, 'current', 'currentUnit', getDefaultUnit('current'));
      editor.current = current.value;
      editor.currentUnit = current.unit;
      const voltage = readValueAndUnit(s, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
    } else if (component.componentType === 'Transformer') {
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
    } else if (component.componentType === 'TestPoint') {
      const tp = component as any;
      editor.signal = tp.signal || '';
    } else if (component.componentType === 'IntegratedCircuit') {
      const ic = component as any;
      // For ICs, description should be synced with designator if description is empty
      // This ensures auto-assigned designators are properly displayed
      editor.description = ic.description || component.designator || '';
      editor.datasheet = ic.datasheet || '';
      editor.icType = ic.icType || 'Op-Amp';
    } else if (component.componentType === 'VacuumTube') {
      const vt = component as any;
      editor.tubeType = vt.tubeType || '';
    } else if (component.componentType === 'VariableResistor') {
      const vr = component as any;
      editor.vrType = vr.vrType || 'Potentiometer';
      const resistance = readValueAndUnit(vr, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      editor.resistance = resistance.value;
      editor.resistanceUnit = resistance.unit;
      const power = readValueAndUnit(vr, 'power', 'powerUnit', getDefaultUnit('power'));
      editor.power = power.value || '1/4';
      editor.taper = vr.taper || '';
    } else if (component.componentType === 'Crystal') {
      const x = component as any;
      editor.frequency = x.frequency || '';
      editor.loadCapacitance = x.loadCapacitance || '';
      editor.tolerance = x.tolerance || '';
    } else if (component.componentType === 'ZenerDiode') {
      const z = component as any;
      const voltage = readValueAndUnit(z, 'voltage', 'voltageUnit', getDefaultUnit('voltage'));
      editor.voltage = voltage.value;
      editor.voltageUnit = voltage.unit;
      const power = readValueAndUnit(z, 'power', 'powerUnit', getDefaultUnit('power'));
      editor.power = power.value || '1/4';
      editor.tolerance = z.tolerance || '±5%';
    }
    
    setComponentEditor(editor);
  }, []);

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

