import { useState, useCallback } from 'react';
import type { PCBComponent } from '../types';

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
    power?: string;
    tolerance?: string;
    // Capacitor
    capacitance?: string;
    voltage?: string;
    dielectric?: string;
    // Diode
    diodeType?: 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Other';
    current?: string;
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
    if (component.componentType === 'Resistor') {
      const r = component as any;
      editor.resistance = r.resistance || '';
      editor.power = r.power || '';
      editor.tolerance = r.tolerance || '';
    } else if (component.componentType === 'Capacitor') {
      const c = component as any;
      editor.capacitance = c.capacitance || '';
      editor.voltage = c.voltage || '';
      editor.tolerance = c.tolerance || '';
      editor.dielectric = c.dielectric || '';
    } else if (component.componentType === 'Diode') {
      const d = component as any;
      editor.diodeType = d.diodeType || 'Standard';
      editor.voltage = d.voltage || '';
      editor.current = d.current || '';
      editor.ledColor = d.ledColor || '';
    } else if (component.componentType === 'Battery') {
      const b = component as any;
      editor.voltage = b.voltage || '';
      editor.capacity = b.capacity || '';
      editor.chemistry = b.chemistry || '';
    } else if (component.componentType === 'Fuse') {
      const f = component as any;
      editor.current = f.current || '';
      editor.voltage = f.voltage || '';
      editor.fuseType = f.fuseType || '';
    } else if (component.componentType === 'FerriteBead') {
      const fb = component as any;
      editor.impedance = fb.impedance || '';
      editor.current = fb.current || '';
    } else if (component.componentType === 'Connector') {
      const conn = component as any;
      editor.connectorType = conn.connectorType || '';
      editor.gender = conn.gender || 'N/A';
    } else if (component.componentType === 'Jumper') {
      const j = component as any;
      editor.positions = j.positions || 3;
    } else if (component.componentType === 'Relay') {
      const r = component as any;
      editor.coilVoltage = r.coilVoltage || '';
      editor.contactType = r.contactType || '';
      editor.current = r.current || '';
    } else if (component.componentType === 'Inductor') {
      const i = component as any;
      editor.inductance = i.inductance || '';
      editor.current = i.current || '';
      editor.resistance = i.resistance || '';
    } else if (component.componentType === 'Speaker') {
      const s = component as any;
      editor.impedance = s.impedance || '';
      editor.power = s.power || '';
    } else if (component.componentType === 'Motor') {
      const m = component as any;
      editor.motorType = m.motorType || '';
      editor.voltage = m.voltage || '';
      editor.current = m.current || '';
    } else if (component.componentType === 'PowerSupply') {
      const ps = component as any;
      editor.inputVoltage = ps.inputVoltage || '';
      editor.outputVoltage = ps.outputVoltage || '';
      editor.current = ps.current || '';
    } else if (component.componentType === 'Transistor') {
      const t = component as any;
      editor.transistorType = t.transistorType || 'BJT';
      editor.polarity = t.polarity || 'NPN';
      editor.voltage = t.voltage || '';
      editor.current = t.current || '';
    } else if (component.componentType === 'ResistorNetwork') {
      const rn = component as any;
      editor.resistance = rn.resistance || '';
      editor.configuration = rn.configuration || '';
    } else if (component.componentType === 'Thermistor') {
      const t = component as any;
      editor.resistance = t.resistance || '';
      editor.thermistorType = t.thermistorType || 'NTC';
      editor.beta = t.beta || '';
    } else if (component.componentType === 'Switch') {
      const s = component as any;
      editor.switchType = s.switchType || '';
      editor.current = s.current || '';
      editor.voltage = s.voltage || '';
    } else if (component.componentType === 'Transformer') {
      const t = component as any;
      editor.primaryVoltage = t.primaryVoltage || '';
      editor.secondaryVoltage = t.secondaryVoltage || '';
      editor.power = t.power || '';
      editor.turns = t.turns || '';
    } else if (component.componentType === 'TestPoint') {
      const tp = component as any;
      editor.signal = tp.signal || '';
    } else if (component.componentType === 'IntegratedCircuit') {
      const ic = component as any;
      editor.description = ic.description || '';
      editor.datasheet = ic.datasheet || '';
      editor.icType = ic.icType || '';
    } else if (component.componentType === 'VacuumTube') {
      const vt = component as any;
      editor.tubeType = vt.tubeType || '';
    } else if (component.componentType === 'VariableResistor') {
      const vr = component as any;
      editor.vrType = vr.vrType || 'Potentiometer';
      editor.resistance = vr.resistance || '';
      editor.power = vr.power || '';
      editor.taper = vr.taper || '';
    } else if (component.componentType === 'Crystal') {
      const x = component as any;
      editor.frequency = x.frequency || '';
      editor.loadCapacitance = x.loadCapacitance || '';
      editor.tolerance = x.tolerance || '';
    } else if (component.componentType === 'ZenerDiode') {
      const z = component as any;
      editor.voltage = z.voltage || '';
      editor.power = z.power || '';
      editor.tolerance = z.tolerance || '';
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

