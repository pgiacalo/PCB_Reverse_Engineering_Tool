// ============================================================================
// Component Management Utilities
// ============================================================================

import type { 
  PCBComponent, 
  PCBComponentBase,
  ComponentType,
  Battery,
  Capacitor,
  CapacitorElectrolytic,
  Diode,
  Fuse,
  FerriteBead,
  Connector,
  Jumper,
  Relay,
  Inductor,
  Speaker,
  Motor,
  PowerSupply,
  Transistor,
  Resistor,
  ResistorNetwork,
  Thermistor,
  Switch,
  Transformer,
  TestPoint,
  IntegratedCircuit,
  VacuumTube,
  VariableResistor,
  Crystal,
  ZenerDiode,
} from '../types';
import { COMPONENT_TYPE_INFO, COMPONENT_ICON } from '../constants';
import { generateUniqueId } from './coordinates';

/**
 * Get default pin count for a component type
 */
export function getDefaultPinCount(componentType: ComponentType): number {
  return COMPONENT_TYPE_INFO[componentType]?.defaultPins || 2;
}

/**
 * Get default designator prefix for a component type
 */
export function getDefaultPrefix(componentType: ComponentType): string {
  const prefixes = COMPONENT_TYPE_INFO[componentType]?.prefix || ['?'];
  return prefixes[0];
}

/**
 * Create a new component instance with default values
 */
export function createComponent(
  componentType: ComponentType,
  layer: 'top' | 'bottom',
  x: number,
  y: number,
  color: string,
  size: number = COMPONENT_ICON.DEFAULT_SIZE
): PCBComponent {
  const baseComponent: PCBComponentBase = {
    id: generateUniqueId('comp'),
    componentType,
    designator: '', // Will be set by user
    layer,
    x,
    y,
    color,
    size,
    pinCount: getDefaultPinCount(componentType),
    pinConnections: [],
    orientation: 0, // Default orientation: 0 degrees
  };

  // Initialize pinConnections array with empty strings
  baseComponent.pinConnections = new Array(baseComponent.pinCount).fill('');
  
  // Initialize pinPolarities for components that have polarity
  const hasPolarity = componentType === 'CapacitorElectrolytic' || 
                     componentType === 'Diode' || 
                     componentType === 'Battery' || 
                     componentType === 'ZenerDiode';
  if (hasPolarity) {
    baseComponent.pinPolarities = new Array(baseComponent.pinCount).fill('');
  }

  // Create specific component type with default values
  switch (componentType) {
    case 'Battery':
      return { ...baseComponent, componentType: 'Battery' } as Battery;
    
    case 'Capacitor':
      return { ...baseComponent, componentType: 'Capacitor' } as Capacitor;
    
    case 'CapacitorElectrolytic':
      return { ...baseComponent, componentType: 'CapacitorElectrolytic', polarity: 'Positive' } as CapacitorElectrolytic;
    
    case 'Diode':
      return { ...baseComponent, componentType: 'Diode', diodeType: 'Standard' } as Diode;
    
    case 'Fuse':
      return { ...baseComponent, componentType: 'Fuse' } as Fuse;
    
    case 'FerriteBead':
      return { ...baseComponent, componentType: 'FerriteBead' } as FerriteBead;
    
    case 'Connector':
      return { ...baseComponent, componentType: 'Connector', gender: 'N/A' } as Connector;
    
    case 'Jumper':
      return { ...baseComponent, componentType: 'Jumper' } as Jumper;
    
    case 'Relay':
      return { ...baseComponent, componentType: 'Relay' } as Relay;
    
    case 'Inductor':
      return { ...baseComponent, componentType: 'Inductor' } as Inductor;
    
    case 'Speaker':
      return { ...baseComponent, componentType: 'Speaker' } as Speaker;
    
    case 'Motor':
      return { ...baseComponent, componentType: 'Motor' } as Motor;
    
    case 'PowerSupply':
      return { ...baseComponent, componentType: 'PowerSupply' } as PowerSupply;
    
    case 'Transistor':
      return { ...baseComponent, componentType: 'Transistor', transistorType: 'BJT' } as Transistor;
    
    case 'Resistor':
      return { ...baseComponent, componentType: 'Resistor' } as Resistor;
    
    case 'ResistorNetwork':
      return { ...baseComponent, componentType: 'ResistorNetwork' } as ResistorNetwork;
    
    case 'Thermistor':
      return { ...baseComponent, componentType: 'Thermistor', thermistorType: 'NTC' } as Thermistor;
    
    case 'Switch':
      return { ...baseComponent, componentType: 'Switch' } as Switch;
    
    case 'Transformer':
      return { ...baseComponent, componentType: 'Transformer' } as Transformer;
    
    case 'TestPoint':
      return { ...baseComponent, componentType: 'TestPoint' } as TestPoint;
    
    case 'IntegratedCircuit':
      return { ...baseComponent, componentType: 'IntegratedCircuit' } as IntegratedCircuit;
    
    case 'VacuumTube':
      return { ...baseComponent, componentType: 'VacuumTube' } as VacuumTube;
    
    case 'VariableResistor':
      return { ...baseComponent, componentType: 'VariableResistor', vrType: 'Potentiometer' } as VariableResistor;
    
    case 'Crystal':
      return { ...baseComponent, componentType: 'Crystal' } as Crystal;
    
    case 'CapacitorElectrolytic':
      return { ...baseComponent, componentType: 'CapacitorElectrolytic', polarity: 'Positive' } as CapacitorElectrolytic;
    
    case 'ZenerDiode':
      return { ...baseComponent, componentType: 'ZenerDiode' } as ZenerDiode;
    
    default:
      return { ...baseComponent, componentType: 'Resistor' } as Resistor;
  }
}

/**
 * Update pin connections array when pin count changes
 */
export function updatePinConnections(
  component: PCBComponent,
  newPinCount: number
): PCBComponent {
  const oldConnections = component.pinConnections;
  const newConnections = new Array(newPinCount).fill('');
  
  // Copy existing connections
  for (let i = 0; i < Math.min(oldConnections.length, newPinCount); i++) {
    newConnections[i] = oldConnections[i];
  }
  
  return {
    ...component,
    pinCount: newPinCount,
    pinConnections: newConnections,
  };
}

/**
 * Set a pin connection
 */
export function setPinConnection(
  component: PCBComponent,
  pinIndex: number,
  nodeId: string
): PCBComponent {
  if (pinIndex < 0 || pinIndex >= component.pinCount) {
    console.error(`Invalid pin index ${pinIndex} for component with ${component.pinCount} pins`);
    return component;
  }
  
  const newConnections = [...component.pinConnections];
  newConnections[pinIndex] = nodeId;
  
  return {
    ...component,
    pinConnections: newConnections,
  };
}

/**
 * Clear a pin connection
 */
export function clearPinConnection(
  component: PCBComponent,
  pinIndex: number
): PCBComponent {
  return setPinConnection(component, pinIndex, '');
}

/**
 * Get all connected node IDs for a component
 */
export function getConnectedNodes(component: PCBComponent): string[] {
  return component.pinConnections.filter(nodeId => nodeId !== '');
}

/**
 * Check if a component has any connections
 */
export function hasConnections(component: PCBComponent): boolean {
  return component.pinConnections.some(nodeId => nodeId !== '');
}

/**
 * Auto-assign pin polarity for 2-pin components with polarity
 * Returns the new pinPolarities array if assignment was successful, null otherwise
 */
export function autoAssignPolarity(
  component: PCBComponent,
  pinConnections: string[],
  drawingStrokes: Array<{ type?: 'trace' | 'via' | 'pad'; points: Array<{ x: number; y: number; id?: number }> }>
): ('+' | '-' | '')[] | null {
  // Check if component has polarity
  const hasPolarity = component.componentType === 'CapacitorElectrolytic' || 
                     component.componentType === 'Diode' || 
                     component.componentType === 'Battery' || 
                     component.componentType === 'ZenerDiode';
  const isTantalumCap = component.componentType === 'Capacitor' && 
                       'dielectric' in component && 
                       (component as any).dielectric === 'Tantalum';
  
  if (!(hasPolarity || isTantalumCap) || component.pinCount !== 2) {
    return null;
  }
  
  // Check if both pins are connected
  const bothConnected = pinConnections.length === 2 && 
                       pinConnections[0] && pinConnections[0].trim() !== '' &&
                       pinConnections[1] && pinConnections[1].trim() !== '';
  
  if (!bothConnected) {
    return null;
  }
  
  // Calculate + symbol position
  const orientation = component.orientation || 0;
  const size = component.size || 18;
  const half = size / 2;
  const plusSize = size * 0.25;
  const offsetDistance = half + plusSize * 0.6;
  const angleRad = (orientation * Math.PI) / 180;
  const plusX = component.x + Math.cos(angleRad) * offsetDistance;
  const plusY = component.y + Math.sin(angleRad) * offsetDistance;
  
  // Find coordinates of connected vias/pads
  const findViaPadCoordinates = (pointIdStr: string): { x: number; y: number } | null => {
    const pointId = parseInt(pointIdStr, 10);
    if (isNaN(pointId)) return null;
    
    // Search in drawingStrokes for via/pad with matching pointId
    for (const stroke of drawingStrokes) {
      if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
        const point = stroke.points[0];
        if (point.id === pointId) {
          return { x: point.x, y: point.y };
        }
      }
    }
    return null;
  };
  
  const pin0Coords = findViaPadCoordinates(pinConnections[0]);
  const pin1Coords = findViaPadCoordinates(pinConnections[1]);
  
  if (!pin0Coords || !pin1Coords) {
    return null;
  }
  
  // Calculate distances from + symbol to each pin's via/pad
  const dist0 = Math.hypot(plusX - pin0Coords.x, plusY - pin0Coords.y);
  const dist1 = Math.hypot(plusX - pin1Coords.x, plusY - pin1Coords.y);
  
  // Set polarity: pin closer to + symbol gets '+', other gets '-'
  const newPolarities: ('+' | '-' | '')[] = ['', ''];
  if (dist0 < dist1) {
    newPolarities[0] = '+';
    newPolarities[1] = '-';
  } else {
    newPolarities[0] = '-';
    newPolarities[1] = '+';
  }
  
  return newPolarities;
}

/**
 * Get component display name (designator or type)
 */
export function getComponentDisplayName(component: PCBComponent): string {
  if (component.designator) {
    return component.designator;
  }
  return component.componentType;
}

/**
 * Validate component data
 */
export function validateComponent(component: PCBComponent): string[] {
  const errors: string[] = [];
  
  if (!component.id) {
    errors.push('Component must have an ID');
  }
  
  if (!component.designator || component.designator.trim() === '') {
    errors.push('Component must have a designator (e.g., U1, R5, C3)');
  }
  
  if (component.pinCount < 1) {
    errors.push('Component must have at least 1 pin');
  }
  
  if (component.pinConnections.length !== component.pinCount) {
    errors.push(`Pin connections array size (${component.pinConnections.length}) must match pin count (${component.pinCount})`);
  }
  
  return errors;
}

/**
 * Get suggested designator for next component of a type
 */
export function suggestNextDesignator(
  componentType: ComponentType,
  existingComponents: PCBComponent[]
): string {
  const prefix = getDefaultPrefix(componentType);
  
  // Find highest number for this prefix
  let maxNumber = 0;
  for (const comp of existingComponents) {
    if (comp.componentType === componentType && comp.designator) {
      const match = comp.designator.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }
  
  return `${prefix}${maxNumber + 1}`;
}

/**
 * Export component to BOM (Bill of Materials) format
 */
export interface BOMEntry {
  designator: string;
  componentType: string;
  packageType?: string;
  partMarkings?: string;
  partNumber?: string;
  value?: string;
  manufacturer?: string;
  description?: string;
  pinCount: number;
  layer: string;
  notes?: string;
}

export function componentToBOM(component: PCBComponent): BOMEntry {
  const base: BOMEntry = {
    designator: component.designator,
    componentType: component.componentType,
    packageType: component.packageType,
    partMarkings: component.partMarkings,
    pinCount: component.pinCount,
    layer: component.layer,
    notes: component.notes,
  };
  
  // Add type-specific fields
  switch (component.componentType) {
    case 'IntegratedCircuit':
      return {
        ...base,
        manufacturer: component.manufacturer,
        partNumber: component.partNumber,
        description: component.description,
      };
    
    case 'Resistor':
      return {
        ...base,
        value: component.resistance,
      };
    
    case 'Capacitor':
      return {
        ...base,
        value: component.capacitance,
      };
    
    case 'Inductor':
      return {
        ...base,
        value: component.inductance,
      };
    
    case 'Transistor':
      return {
        ...base,
        partNumber: component.partNumber,
      };
    
    case 'Diode':
      return {
        ...base,
        partNumber: component.partNumber,
      };
    
    case 'ZenerDiode':
      return base;
    
    default:
      return base;
  }
}

/**
 * Export all components to BOM array
 */
export function exportBOM(components: PCBComponent[]): BOMEntry[] {
  return components.map(componentToBOM).sort((a, b) => {
    // Sort by designator
    return a.designator.localeCompare(b.designator, undefined, { numeric: true });
  });
}

