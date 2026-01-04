import { generateUniqueId } from '../../utils/coordinates';
import { COMPONENT_ICON } from '../../constants';
import type { PCBComponentBase, PCBComponent, ComponentType } from '../../types';
import type { DataDrivenComponentDefinition, ComponentFieldDefinition } from '../definitions/schema';
import type { DesignatorCounters } from './designators';
import { assignDesignator } from './designators';

export interface CreateInstanceOptions {
  definition: DataDrivenComponentDefinition;
  /**
   * Layer for the component ('top' or 'bottom').
   */
  layer: 'top' | 'bottom';
  x: number;
  y: number;
  color: string;
  size?: number;
  /**
   * Optional designator override (e.g., "R5", "C3").
   * If omitted, v2 runtime will assign one using assignDesignator.
   */
  designator?: string;
  existingComponents?: PCBComponent[];
  counters?: DesignatorCounters;
}

/**
 * Create a PCBComponent instance from a data-driven definition.
 * This does not assign designator numbers; it assumes the caller has done so.
 */
export function createComponentInstance(options: CreateInstanceOptions): PCBComponent {
  const {
    definition,
    layer,
    x,
    y,
    color,
    size,
    designator: providedDesignator,
    existingComponents = [],
    counters = {},
  } = options;
  const iconSize = size && size > 0 ? size : COMPONENT_ICON.DEFAULT_SIZE;

  const designator =
    providedDesignator || assignDesignator(definition, existingComponents, counters);

  // Use componentType from definition (data-driven source of truth)
  // This eliminates the need for hardcoded mapping logic
  const componentType = (definition.componentType as ComponentType) || (definition.type as ComponentType);

  const base: PCBComponentBase & { [key: string]: any } = {
    id: generateUniqueId('comp'),
    componentType: componentType,  // Use componentType from definition (data-driven)
    designator,
    layer,
    x,
    y,
    color,
    size: iconSize,
    pinCount: definition.defaultPins,
    pinConnections: new Array(definition.defaultPins).fill(''),
    pinPolarities: undefined,
    notes: null,
    orientation: 0,
    flipX: false,
    flipY: false,
    description: definition.description,
  };

  // Store definition key so dialogs/editors can resolve metadata later
  base.componentDefinitionKey = definition.key;

  // Attach "properties" block as flat fields (e.g., capacitorType, diodeType, etc.)
  if (definition.properties) {
    Object.assign(base, definition.properties);
  }

  // Initialize pinNames from definition defaults (user can edit later)
  // Do this AFTER Object.assign so pinNames from properties are available
  // Create a new array that matches pinCount, filling with default names
  // Special case: If pinNames contains "CHIP_DEPENDENT", initialize with empty strings
  if (definition.properties?.pinNames && Array.isArray(definition.properties.pinNames)) {
    const defaultPinNames = definition.properties.pinNames as string[];
    const isChipDependent = defaultPinNames.includes('CHIP_DEPENDENT');
    if (isChipDependent) {
      // For CHIP_DEPENDENT, initialize with empty strings (user will fill in)
      base.pinNames = new Array(base.pinCount).fill('');
    } else {
      // For predefined names, fill with default names
      base.pinNames = new Array(base.pinCount).fill('').map((_, i) => 
        i < defaultPinNames.length ? defaultPinNames[i] : ''
      );
    }
  }

  // Initialize fields with default values and units
  if (definition.fields && definition.fields.length > 0) {
    definition.fields.forEach((field: ComponentFieldDefinition) => {
      if (field.defaultValue !== undefined && field.defaultValue !== '') {
        base[field.name] = field.defaultValue;
      }
      if (field.units && field.defaultUnit) {
        base[`${field.name}Unit`] = field.defaultUnit;
      }
    });
  }

  return base as PCBComponent;
}


