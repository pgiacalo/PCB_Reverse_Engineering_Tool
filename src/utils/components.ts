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

// ============================================================================
// Component Management Utilities
// ============================================================================

import type { 
  PCBComponent, 
  PCBComponentBase,
  ComponentType,
  Battery,
  Capacitor,
  ElectrolyticCapacitor,
  FilmCapacitor,
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
  GenericComponent,
} from '../types';
import { COMPONENT_TYPE_INFO, COMPONENT_ICON } from '../constants';
import type { ComponentDefinition, ComponentFieldDefinition } from '../data/componentDefinitions.d';
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
 * Automatically assigns designator based on component type and existing components if autoAssign is true
 */
export function createComponent(
  componentType: ComponentType,
  layer: 'top' | 'bottom',
  x: number,
  y: number,
  color: string,
  size: number | undefined = undefined,
  existingComponents: PCBComponent[] = [],
  counters: DesignatorCounters = loadDesignatorCounters(),
  autoAssign: boolean = true,
  metadata?: {
    designator?: string;
    subtype?: string;
    componentDefinition?: ComponentDefinition;
  }
): PCBComponent {
  // Ensure all components use the same default size if not specified or if size is invalid
  // This ensures consistent icon sizes unless explicitly changed by the user
  const componentSize = (size !== undefined && size > 0) ? size : COMPONENT_ICON.DEFAULT_SIZE;
  // Automatically assign designator if enabled
  let designator = '';
  if (autoAssign) {
    // Use designator from metadata if provided, otherwise use default prefix
    const prefix = metadata?.designator || getDefaultPrefix(componentType);
    const nextNumber = getNextDesignatorNumber(prefix, existingComponents, counters);
    designator = `${prefix}${nextNumber}`;
    
    // Note: Counter updating is now handled by the caller (App.tsx) after component creation
    // This allows the caller to update counters immediately and reload them for the next component
    // This ensures proper sequencing when placing multiple components rapidly
  }
  
  const baseComponent: PCBComponentBase = {
    id: generateUniqueId('comp'),
    componentType,
    designator, // Automatically assigned
    layer,
    x,
    y,
    color,
    size: componentSize,
    pinCount: getDefaultPinCount(componentType),
    pinConnections: [],
    orientation: 0, // Default orientation: 0 degrees
    flipX: false, // Default: no horizontal flip
    flipY: false, // Default: no vertical flip
  };

  // Store definition key for later lookup in dialogs
  if (metadata?.componentDefinition) {
    const def = metadata.componentDefinition;
    const defKey = `${def.category}:${def.subcategory}`;
    (baseComponent as any).componentDefinitionKey = defKey;
  }

  // Initialize pinConnections array with empty strings
  baseComponent.pinConnections = new Array(baseComponent.pinCount).fill('');
  
  // Initialize pinPolarities for components that are polarized
  // Use properties.polarized from definition as single source of truth
  const isPolarized = metadata?.componentDefinition?.properties?.polarized === true;
  if (isPolarized) {
    baseComponent.pinPolarities = new Array(baseComponent.pinCount).fill('');
  }

  // Apply metadata-based properties and default field values
  const componentDef = metadata?.componentDefinition;
  if (componentDef?.properties) {
    Object.assign(baseComponent as any, componentDef.properties);
  }
  
  // Initialize pinNames from definition defaults (user can edit later)
  // Do this AFTER Object.assign so pinNames from properties are available
  if (componentDef?.properties?.pinNames && Array.isArray(componentDef.properties.pinNames)) {
    const defaultPinNames = componentDef.properties.pinNames as string[];
    (baseComponent as any).pinNames = new Array(baseComponent.pinCount).fill('').map((_, i) => 
      i < defaultPinNames.length ? defaultPinNames[i] : ''
    );
  }
  if (componentDef?.fields) {
    componentDef.fields.forEach((field: ComponentFieldDefinition) => {
      // Set default value if provided
      if (field.defaultValue !== undefined && field.defaultValue !== '') {
        (baseComponent as any)[field.name] = field.defaultValue;
      }
      // Set default unit if provided
      if (field.units && field.defaultUnit) {
        (baseComponent as any)[`${field.name}Unit`] = field.defaultUnit;
      }
    });
  }

  // Create specific component type with default values
  switch (componentType) {
    case 'Battery':
      return { ...baseComponent, componentType: 'Battery' } as Battery;
    
    case 'Capacitor':
      return { ...baseComponent, componentType: 'Capacitor' } as Capacitor;
    
    case 'Electrolytic Capacitor':
      return { ...baseComponent, componentType: 'Electrolytic Capacitor', polarized: true } as ElectrolyticCapacitor;
    
    case 'Film Capacitor':
      return { ...baseComponent, componentType: 'Film Capacitor', filmType: 'Polyester' } as FilmCapacitor;
    
    case 'Diode': {
      // Use subtype from metadata if provided, otherwise default to Standard
      const diodeType = metadata?.subtype === 'LED' ? 'LED' :
                       metadata?.subtype === 'Infrared' ? 'Infrared' :
                       metadata?.subtype === 'Photodiode' ? 'Photodiode' :
                       metadata?.subtype === 'Schottky' ? 'Schottky' :
                       metadata?.subtype === 'Zener' ? 'Zener' :
                       'Standard';
      return { ...baseComponent, componentType: 'Diode', diodeType: diodeType as any } as Diode;
    }
    
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
    
    case 'VariableResistor': {
      // Use subtype from metadata if provided, otherwise default to Potentiometer
      const vrType = metadata?.subtype === 'Varistor' ? 'Varistor' :
                    metadata?.subtype === 'VoltageRegulator' ? 'VoltageRegulator' :
                    'Potentiometer';
      return { ...baseComponent, componentType: 'VariableResistor', vrType: vrType as any } as VariableResistor;
    }
    
    case 'Crystal':
      return { ...baseComponent, componentType: 'Crystal' } as Crystal;
    
    case 'GenericComponent': {
      // Use subtype from metadata if provided, otherwise infer from designator prefix
      let genericType: 'Attenuator' | 'CircuitBreaker' | 'Thermocouple' | 'Tuner' = 'Attenuator';
      if (metadata?.subtype) {
        genericType = metadata.subtype as 'Attenuator' | 'CircuitBreaker' | 'Thermocouple' | 'Tuner';
      } else if (designator) {
        if (designator.startsWith('AT')) {
          genericType = 'Attenuator';
        } else if (designator.startsWith('CB')) {
          genericType = 'CircuitBreaker';
        } else if (designator.startsWith('TC')) {
          genericType = 'Thermocouple';
        } else if (designator.startsWith('TUN')) {
          genericType = 'Tuner';
        }
      }
      return { ...baseComponent, componentType: 'GenericComponent', genericType } as GenericComponent;
    }
    
    default:
      // Log warning if component type is not recognized
      console.warn(`Unknown component type: ${componentType}, defaulting to Resistor`);
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

import { resolveComponentDefinition } from './componentDefinitionResolver';

/**
 * Check if a component is polarized based on its definition.
 * Uses properties.polarized from the component definition as the single source of truth.
 */
export function isComponentPolarized(component: PCBComponent): boolean {
  const def = resolveComponentDefinition(component);
  return def?.properties?.polarized === true;
}

/**
 * Auto-assign pin polarity for 2-pin components with polarity
 * Returns the new pinPolarities array if assignment was successful, null otherwise
 */
export function autoAssignPolarity(
  component: PCBComponent,
  pinConnections: string[],
  drawingStrokes: Array<{ type?: 'trace' | 'via' | 'pad' | 'testPoint'; points: Array<{ x: number; y: number; id?: number }> }>
): ('+' | '-' | '')[] | null {
  // Check if component has polarity using definition
  if (!isComponentPolarized(component) || component.pinCount !== 2) {
    return null;
  }
  
  // Check if both pins are connected
  const bothConnected = pinConnections.length === 2 && 
                       pinConnections[0] && pinConnections[0].trim() !== '' &&
                       pinConnections[1] && pinConnections[1].trim() !== '';
  
  if (!bothConnected) {
    return null;
  }
  
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
  
  // Calculate distances from component center to each pin's via/pad
  const dist0 = Math.hypot(component.x - pin0Coords.x, component.y - pin0Coords.y);
  const dist1 = Math.hypot(component.x - pin1Coords.x, component.y - pin1Coords.y);
  
  // Set polarity: pin closer to via/pad (shorter distance) gets '-', other gets '+'
  const newPolarities: ('+' | '-' | '')[] = ['', ''];
  if (dist0 < dist1) {
    newPolarities[0] = '-';
    newPolarities[1] = '+';
  } else {
    newPolarities[0] = '+';
    newPolarities[1] = '-';
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
 * Designator counter management
 * Tracks the last used number for each designator prefix (C, R, Q, U, etc.)
 * 
 * Note: Counters are now stored in memory only and saved/loaded from project files.
 * No localStorage is used - every new project starts with empty counters.
 * The counters are passed in from App.tsx which manages them via sessionDesignatorCountersRef.
 */
export type DesignatorCounters = Record<string, number>; // prefix -> last number

/**
 * Get empty/default designator counters
 * Called when creating a new project or when no counters are available
 */
export function getDefaultDesignatorCounters(): DesignatorCounters {
  return {};
}

/**
 * @deprecated - No longer used. Counters are managed in memory by App.tsx
 * Returns empty object for compatibility
 */
export function loadDesignatorCounters(): DesignatorCounters {
  return {};
}

/**
 * @deprecated - No longer used. Counters are managed in memory by App.tsx
 * No-op for compatibility
 */
export function saveDesignatorCounters(_counters: DesignatorCounters): void {
  // No-op: localStorage is no longer used for designator counters
  // Counters are saved as part of the project file
}

/**
 * Get the next designator number for a prefix
 */
export function getNextDesignatorNumber(
  prefix: string,
  existingComponents: PCBComponent[],
  counters: DesignatorCounters
): number {
  // First, check existing components for the highest number with this prefix
  let maxNumber = 0;
  for (const comp of existingComponents) {
    if (comp.designator) {
      // Check if designator starts with this prefix followed by a number
      const prefixMatch = comp.designator.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
      if (prefixMatch) {
        const num = parseInt(prefixMatch[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }
  
  // Then check the persisted counter
  const counterValue = counters[prefix] || 0;
  
  // Return the maximum of both, plus 1
  return Math.max(maxNumber, counterValue) + 1;
}

/**
 * Update designator counter for a prefix
 */
export function updateDesignatorCounter(
  prefix: string,
  number: number,
  counters: DesignatorCounters
): DesignatorCounters {
  const updated = { ...counters };
  updated[prefix] = Math.max(updated[prefix] || 0, number);
  return updated;
}

/**
 * Get suggested designator for next component of a type
 */
export function suggestNextDesignator(
  componentType: ComponentType,
  existingComponents: PCBComponent[],
  counters: DesignatorCounters = loadDesignatorCounters()
): string {
  const prefix = getDefaultPrefix(componentType);
  const nextNumber = getNextDesignatorNumber(prefix, existingComponents, counters);
  return `${prefix}${nextNumber}`;
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
    notes: component.notes ?? undefined, // Convert null to undefined
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

