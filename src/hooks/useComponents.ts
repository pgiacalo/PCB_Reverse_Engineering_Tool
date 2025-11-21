import { useState, useCallback } from 'react';
import type { PCBComponent } from '../types';

/**
 * Parse a value string to extract number and unit
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
    // Resistor / ResistorNetwork / Thermistor / VariableResistor
    resistance?: string;
    resistanceUnit?: string; // Ω, kΩ, MΩ
    power?: string;
    powerUnit?: string; // W (default)
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
    temperature?: string;
    // Diode
    diodeType?: 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Other';
    current?: string;
    currentUnit?: string; // A, mA, µA
    ledColor?: string;
    // Battery
    capacity?: string;
    chemistry?: string;
    // Fuse
    fuseType?: string;
    // FerriteBead
    impedance?: string;
    // Connector
    connectorType?: string;
    gender?: 'Male' | 'Female' | 'N/A';
    // Jumper
    positions?: number;
    // Relay
    coilVoltage?: string;
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
    outputVoltage?: string;
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
    secondaryVoltage?: string;
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
      setComponentsTop(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setComponentsBottom(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
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
    const editor: any = {
      visible: true,
      layer,
      id: component.id,
      designator: component.designator || '',
      abbreviation: (component as any).abbreviation || '',
      manufacturer: 'manufacturer' in component ? (component as any).manufacturer || '' : '',
      partNumber: 'partNumber' in component ? (component as any).partNumber || '' : '',
      pinCount: component.pinCount,
      x: component.x,
      y: component.y,
      orientation: component.orientation ?? 0,
    };
    
    // Extract type-specific fields based on component type
    // Parse values to separate number and unit
    if (component.componentType === 'Resistor') {
      const r = component as any;
      const resistanceParsed = parseValueWithUnit(r.resistance);
      editor.resistance = resistanceParsed.value;
      editor.resistanceUnit = resistanceParsed.unit || 'Ω';
      const powerParsed = parseValueWithUnit(r.power);
      editor.power = powerParsed.value || '1/4';
      editor.powerUnit = powerParsed.unit || 'W';
      editor.tolerance = r.tolerance || '±5%';
    } else if (component.componentType === 'Capacitor') {
      const c = component as any;
      const capacitanceParsed = parseValueWithUnit(c.capacitance);
      editor.capacitance = capacitanceParsed.value;
      editor.capacitanceUnit = capacitanceParsed.unit || 'nF';
      const voltageParsed = parseValueWithUnit(c.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      editor.tolerance = c.tolerance || '±10%';
      editor.dielectric = c.dielectric || 'Ceramic';
    } else if (component.componentType === 'Electrolytic Capacitor') {
      const c = component as any;
      const capacitanceParsed = parseValueWithUnit(c.capacitance);
      editor.capacitance = capacitanceParsed.value;
      editor.capacitanceUnit = capacitanceParsed.unit || 'µF';
      const voltageParsed = parseValueWithUnit(c.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      editor.tolerance = c.tolerance || '±20%';
      editor.polarityCapacitor = c.polarity || 'Positive';
      editor.esr = c.esr || '';
      editor.temperature = c.temperature || '';
    } else if (component.componentType === 'Diode') {
      const d = component as any;
      editor.diodeType = d.diodeType || 'Standard';
      const voltageParsed = parseValueWithUnit(d.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      const currentParsed = parseValueWithUnit(d.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
      editor.ledColor = d.ledColor || '';
    } else if (component.componentType === 'Battery') {
      const b = component as any;
      const voltageParsed = parseValueWithUnit(b.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      editor.capacity = b.capacity || '';
      editor.chemistry = b.chemistry || 'Li-ion';
    } else if (component.componentType === 'Fuse') {
      const f = component as any;
      const currentParsed = parseValueWithUnit(f.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
      const voltageParsed = parseValueWithUnit(f.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      editor.fuseType = f.fuseType || 'Fast-blow';
    } else if (component.componentType === 'FerriteBead') {
      const fb = component as any;
      editor.impedance = fb.impedance || '';
      const currentParsed = parseValueWithUnit(fb.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
    } else if (component.componentType === 'Connector') {
      const conn = component as any;
      editor.connectorType = conn.connectorType || '';
      editor.gender = conn.gender || 'N/A';
    } else if (component.componentType === 'Jumper') {
      const j = component as any;
      editor.positions = j.positions || 3;
    } else if (component.componentType === 'Relay') {
      const r = component as any;
      const voltageParsed = parseValueWithUnit(r.coilVoltage);
      editor.coilVoltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      editor.contactType = r.contactType || 'SPST';
      const currentParsed = parseValueWithUnit(r.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
    } else if (component.componentType === 'Inductor') {
      const i = component as any;
      const inductanceParsed = parseValueWithUnit(i.inductance);
      editor.inductance = inductanceParsed.value;
      editor.inductanceUnit = inductanceParsed.unit || 'µH';
      const currentParsed = parseValueWithUnit(i.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
      const resistanceParsed = parseValueWithUnit(i.resistance);
      editor.resistance = resistanceParsed.value;
      editor.resistanceUnit = resistanceParsed.unit || 'Ω';
    } else if (component.componentType === 'Speaker') {
      const s = component as any;
      editor.impedance = s.impedance || '';
      const powerParsed = parseValueWithUnit(s.power);
      editor.power = powerParsed.value || '1';
      editor.powerUnit = powerParsed.unit || 'W';
    } else if (component.componentType === 'Motor') {
      const m = component as any;
      editor.motorType = m.motorType || 'DC';
      const voltageParsed = parseValueWithUnit(m.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      const currentParsed = parseValueWithUnit(m.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
    } else if (component.componentType === 'PowerSupply') {
      const ps = component as any;
      const inputVoltageParsed = parseValueWithUnit(ps.inputVoltage);
      editor.inputVoltage = inputVoltageParsed.value;
      editor.voltageUnit = inputVoltageParsed.unit || 'V';
      const outputVoltageParsed = parseValueWithUnit(ps.outputVoltage);
      editor.outputVoltage = outputVoltageParsed.value;
      const currentParsed = parseValueWithUnit(ps.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
    } else if (component.componentType === 'Transistor') {
      const t = component as any;
      editor.transistorType = t.transistorType || 'BJT';
      editor.polarity = t.polarity || 'NPN';
      const voltageParsed = parseValueWithUnit(t.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      const currentParsed = parseValueWithUnit(t.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
    } else if (component.componentType === 'ResistorNetwork') {
      const rn = component as any;
      const resistanceParsed = parseValueWithUnit(rn.resistance);
      editor.resistance = resistanceParsed.value;
      editor.resistanceUnit = resistanceParsed.unit || 'Ω';
      editor.configuration = rn.configuration || '';
    } else if (component.componentType === 'Thermistor') {
      const t = component as any;
      const resistanceParsed = parseValueWithUnit(t.resistance);
      editor.resistance = resistanceParsed.value;
      editor.resistanceUnit = resistanceParsed.unit || 'Ω';
      editor.thermistorType = t.thermistorType || 'NTC';
      editor.beta = t.beta || '';
    } else if (component.componentType === 'Switch') {
      const s = component as any;
      editor.switchType = s.switchType || 'Toggle';
      const currentParsed = parseValueWithUnit(s.current);
      editor.current = currentParsed.value;
      editor.currentUnit = currentParsed.unit || 'A';
      const voltageParsed = parseValueWithUnit(s.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
    } else if (component.componentType === 'Transformer') {
      const t = component as any;
      const primaryVoltageParsed = parseValueWithUnit(t.primaryVoltage);
      editor.primaryVoltage = primaryVoltageParsed.value;
      editor.voltageUnit = primaryVoltageParsed.unit || 'V';
      const secondaryVoltageParsed = parseValueWithUnit(t.secondaryVoltage);
      editor.secondaryVoltage = secondaryVoltageParsed.value;
      const powerParsed = parseValueWithUnit(t.power);
      editor.power = powerParsed.value || '1';
      editor.powerUnit = powerParsed.unit || 'W';
      editor.turns = t.turns || '';
    } else if (component.componentType === 'TestPoint') {
      const tp = component as any;
      editor.signal = tp.signal || '';
    } else if (component.componentType === 'IntegratedCircuit') {
      const ic = component as any;
      editor.description = ic.description || '';
      editor.datasheet = ic.datasheet || '';
      editor.icType = ic.icType || 'Op-Amp';
    } else if (component.componentType === 'VacuumTube') {
      const vt = component as any;
      editor.tubeType = vt.tubeType || '';
    } else if (component.componentType === 'VariableResistor') {
      const vr = component as any;
      editor.vrType = vr.vrType || 'Potentiometer';
      const resistanceParsed = parseValueWithUnit(vr.resistance);
      editor.resistance = resistanceParsed.value;
      editor.resistanceUnit = resistanceParsed.unit || 'Ω';
      const powerParsed = parseValueWithUnit(vr.power);
      editor.power = powerParsed.value || '1/4';
      editor.powerUnit = powerParsed.unit || 'W';
      editor.taper = vr.taper || '';
    } else if (component.componentType === 'Crystal') {
      const x = component as any;
      editor.frequency = x.frequency || '';
      editor.loadCapacitance = x.loadCapacitance || '';
      editor.tolerance = x.tolerance || '';
    } else if (component.componentType === 'ZenerDiode') {
      const z = component as any;
      const voltageParsed = parseValueWithUnit(z.voltage);
      editor.voltage = voltageParsed.value;
      editor.voltageUnit = voltageParsed.unit || 'V';
      const powerParsed = parseValueWithUnit(z.power);
      editor.power = powerParsed.value || '1/4';
      editor.powerUnit = powerParsed.unit || 'W';
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

