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
// Application Constants
// ============================================================================

export const APP_VERSION = '3.1.0';

// ============================================================================
// Canvas and Drawing Constants
// ============================================================================

export const CONTENT_BORDER = 5; // fixed border (in canvas pixels) where nothing is drawn
export const DEFAULT_BRUSH_SIZE = 10;
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 50;
export const SNAP_DISTANCE = 10; // pixels - distance for snapping to vias

// ============================================================================
// Zoom and View Constants
// ============================================================================

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
export const ZOOM_STEP = 1.2;
export const DEFAULT_ZOOM = 1;

// ============================================================================
// Transform Constants
// ============================================================================

export const NUDGE_STEP = 1; // pixels
export const SCALE_STEP = 0.01;
export const ROTATION_STEP = 1; // degrees
export const SLANT_STEP = 0.5; // degrees
export const KEYSTONE_STEP = 0.5; // degrees

// ============================================================================
// Color Palette - 32 High-Contrast Colors
// ============================================================================

export const COLOR_PALETTE = [
  // Row 1: Neutrals (light to dark, left to right)
  '#FFFFFF', '#BFBFBF', '#7F7F7F', '#3C3C3C', '#000000',
  // Row 1 continued: Light blues (light to dark)
  '#A6CEE3', '#56B4E9', '#17BECF',
  
  // Row 2: Blues and cyans (light to dark, left to right)
  '#00BFC4', '#1F77B4', '#0072B2', '#332288',
  // Row 2 continued: Light greens (light to dark)
  '#B2DF8A', '#B3DE69', '#2CA02C', '#009E73',
  
  // Row 3: Yellows (light to dark, left to right)
  '#FFED6F', '#F0E442', '#BCBD22',
  // Row 3 continued: Oranges (light to dark)
  '#E69F00', '#FF7F0E',
  // Row 3 continued: Light pinks (light to dark)
  '#FB9A99', '#F781BF',
  
  // Row 4: Reds (light to dark, left to right)
  '#E15759', '#D62728',
  // Row 4 continued: Purples (light to dark) - all purples grouped together
  '#CAB2D6', '#CC79A7', '#AA4499', '#6A3D9A', '#9467BD',
  // Row 4 continued: Browns (light to dark)
  '#9C755F', '#8C564B',
];

export const PALETTE_COLUMNS = 8;
export const PALETTE_ROWS = 4;
export const COLOR_SWATCH_SIZE = 24; // pixels

// ============================================================================
// Default Colors
// ============================================================================

export const DEFAULT_BRUSH_COLOR = '#ff0000';
export const DEFAULT_VIA_COLOR = '#2CA02C'; // Dark green
export const DEFAULT_TRACE_COLOR = '#F0E442'; // Bright yellow
export const DEFAULT_COMPONENT_COLOR = '#00BFC4'; // Bright teal
export const DEFAULT_GROUND_COLOR = '#000000'; // Dark black
export const DEFAULT_PAD_COLOR = '#00008b'; // Dark blue
export const DEFAULT_POWER_COLOR = '#FF0000'; // Bright red

// ============================================================================
// Selection Colors
// ============================================================================

export const SELECTION_COLOR = '#00bfff';
export const SELECTION_DASH = [4, 3];
export const SELECTION_LINE_WIDTH = 1.5;

// ============================================================================
// Layer Z-Order (higher = rendered on top)
// ============================================================================

export const Z_ORDER = {
  IMAGES: 0,
  TRACES: 10,
  COMPONENTS: 20,
  GROUND: 30,
  VIAS: 100, // Always on top
  SELECTION: 200,
};

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  SELECT: 's',
  VIA: 'v',
  TRACE: 't',
  PAD: 'p',
  COMPONENT: 'c',
  POWER: 'b',
  GROUND: 'g',
  ERASE: 'e',
  MOVE: 'h',
  ZOOM: 'm',
  UNDO: 'z', // with Ctrl modifier
  DELETE: ['Delete', 'Backspace'],
  ESCAPE: 'Escape',
  ENTER: 'Enter',
};

// ============================================================================
// File System
// ============================================================================

export const PROJECT_FILE_EXTENSION = '.json';
export const DEFAULT_PROJECT_NAME = 'pcb_project';

// ============================================================================
// Component Icon Dimensions
// ============================================================================

export const COMPONENT_ICON = {
  DEFAULT_SIZE: 18,
  MIN_SIZE: 12,
  MAX_SIZE: 100,
};

// ============================================================================
// Component Type Metadata
// ============================================================================

// Import component definitions from externalized JSON file (bundled at build time)
// Vite bundles JSON imports into the JavaScript bundle, making them available in memory at runtime
import componentDefinitions from '../data/componentDefinitions.json';
import type { ComponentDefinition } from '../data/componentDefinitions.d';

// Type definitions for component info
export interface ComponentTypeInfo {
  /**
   * All known designator prefixes for this logical component type
   * (e.g., 'R', 'RN', 'RT', 'RV' for the resistor family).
   */
  prefix: readonly string[];
  /**
   * Default pin count when creating a new instance of this type.
   */
  defaultPins: number;
}

// Build COMPONENT_TYPE_INFO from the JSON definitions.
// NOTE: The map is keyed by the raw `type` string from the JSON (e.g., "Resistor", "PowerEnergy").
// Higher‑level code is free to index it with more specific ComponentType strings where appropriate.
const componentTypeInfoMap: Record<string, ComponentTypeInfo> = {};
componentDefinitions.components.forEach(comp => {
  const key = comp.type;
  const prefix = comp.designator;

  if (!componentTypeInfoMap[key]) {
    componentTypeInfoMap[key] = {
      prefix: [prefix],
      defaultPins: comp.defaultPins,
    };
  } else {
    const existing = componentTypeInfoMap[key];
    const mergedPrefixes = [...new Set([...existing.prefix, prefix])];
    componentTypeInfoMap[key] = {
      prefix: mergedPrefixes,
      defaultPins: existing.defaultPins,
    };
  }
});
export const COMPONENT_TYPE_INFO = componentTypeInfoMap as Record<string, ComponentTypeInfo>;

// Build COMPONENT_CATEGORIES from new structure (for backward compatibility)
// Converts flat components array to hierarchical category structure
const componentCategoriesMap: Record<string, Record<string, readonly string[]>> = {};
componentDefinitions.components.forEach(comp => {
  if (!componentCategoriesMap[comp.category]) {
    componentCategoriesMap[comp.category] = {};
  }
  if (!componentCategoriesMap[comp.category][comp.subcategory]) {
    componentCategoriesMap[comp.category][comp.subcategory] = [comp.type] as readonly string[];
  } else {
    // Add type if not already in subcategory
    const existing = componentCategoriesMap[comp.category][comp.subcategory];
    if (!existing.includes(comp.type)) {
      componentCategoriesMap[comp.category][comp.subcategory] = [...existing, comp.type] as readonly string[];
    }
  }
});
export const COMPONENT_CATEGORIES = componentCategoriesMap as Record<string, Record<string, readonly string[]>>;

// Export new structure for direct access
export const COMPONENT_DEFINITIONS = componentDefinitions;
export const COMPONENT_LIST: ComponentDefinition[] = componentDefinitions.components as ComponentDefinition[];

// ============================================================================
// Ground Symbol Dimensions
// ============================================================================

export const GROUND_SYMBOL = {
  DEFAULT_SIZE: 18,
  MIN_SIZE: 6,
  MAX_SIZE: 60,
  VERTICAL_LINE_RATIO: 0.9,
  BAR_GAP_RATIO: 0.24,
  WIDTH_RATIO: 1.6,
};

// ============================================================================
// Via Dimensions
// ============================================================================

export const VIA = {
  DEFAULT_SIZE: 18,
  MIN_SIZE: 4,
  MAX_SIZE: 40,
  INNER_CIRCLE_RATIO: 0.5, // inner circle is 50% of outer diameter
};

// ============================================================================
// Component Property Units Lookup Table
// ============================================================================

/**
 * Global lookup table for all component property units.
 * This eliminates the need to parse/combine value+unit strings.
 * Each property that has units is defined here with:
 * - validUnits: array of valid unit strings
 * - defaultUnit: the default unit to use if none specified
 */
export const COMPONENT_PROPERTY_UNITS = {
  // Resistance (Resistor, ResistorNetwork, Thermistor, VariableResistor, Inductor DC resistance)
  resistance: {
    validUnits: ['Ω', 'mΩ', 'kΩ', 'MΩ'],
    defaultUnit: 'Ω',
  },
  // Capacitance (Capacitor, Electrolytic Capacitor)
  capacitance: {
    validUnits: ['pF', 'nF', 'µF', 'mF', 'F'],
    defaultUnit: 'µF',
  },
  // Voltage (Capacitor, Electrolytic Capacitor, Diode, Battery, Fuse, Motor, PowerSupply, Transistor, Switch, Relay coilVoltage)
  voltage: {
    validUnits: ['mV', 'V', 'kV'],
    defaultUnit: 'V',
  },
  // Current (Diode, Fuse, FerriteBead, Relay, Inductor, Motor, PowerSupply, Transistor, Switch)
  current: {
    validUnits: ['µA', 'mA', 'A'],
    defaultUnit: 'A',
  },
  // Power (Resistor, Speaker, Transformer, VariableResistor)
  power: {
    validUnits: ['W', 'mW', 'kW'],
    defaultUnit: 'W',
  },
  // Inductance (Inductor)
  inductance: {
    validUnits: ['nH', 'µH', 'mH', 'H'],
    defaultUnit: 'µH',
  },
  // Impedance (FerriteBead, Speaker)
  impedance: {
    validUnits: ['Ω', 'mΩ', 'kΩ'],
    defaultUnit: 'Ω',
  },
  // Capacity (Battery)
  capacity: {
    validUnits: ['mAh', 'Ah'],
    defaultUnit: 'mAh',
  },
  // Input Voltage (PowerSupply)
  inputVoltage: {
    validUnits: ['mV', 'V', 'kV'],
    defaultUnit: 'V',
  },
  // Output Voltage (PowerSupply)
  outputVoltage: {
    validUnits: ['mV', 'V', 'kV'],
    defaultUnit: 'V',
  },
  // Coil Voltage (Relay)
  coilVoltage: {
    validUnits: ['mV', 'V', 'kV'],
    defaultUnit: 'V',
  },
  // Primary Voltage (Transformer)
  primaryVoltage: {
    validUnits: ['mV', 'V', 'kV'],
    defaultUnit: 'V',
  },
  // Secondary Voltage (Transformer)
  secondaryVoltage: {
    validUnits: ['mV', 'V', 'kV'],
    defaultUnit: 'V',
  },
  // ESR (Electrolytic Capacitor) - Equivalent Series Resistance
  esr: {
    validUnits: ['mΩ', 'Ω'],
    defaultUnit: 'Ω',
  },
} as const;

/**
 * Get valid units for a property
 */
export function getPropertyUnits(propertyName: keyof typeof COMPONENT_PROPERTY_UNITS): readonly string[] {
  return COMPONENT_PROPERTY_UNITS[propertyName]?.validUnits || [];
}

/**
 * Get default unit for a property
 */
export function getDefaultUnit(propertyName: keyof typeof COMPONENT_PROPERTY_UNITS): string {
  return COMPONENT_PROPERTY_UNITS[propertyName]?.defaultUnit || '';
}

/**
 * Check if a unit is valid for a property
 */
export function isValidUnit(propertyName: keyof typeof COMPONENT_PROPERTY_UNITS, unit: string): boolean {
  const property = COMPONENT_PROPERTY_UNITS[propertyName];
  if (!property) return false;
  return (property.validUnits as readonly string[]).includes(unit);
}

/**
 * Format component type name for display by adding spaces between words
 * Examples: IntegratedCircuit -> "Integrated Circuit", VariableResistor -> "Variable Resistor"
 * Types that already have spaces (e.g., "Electrolytic Capacitor") are returned as-is
 */
export function formatComponentTypeName(componentType: string): string {
  // If it already contains a space, return as-is
  if (componentType.includes(' ')) {
    return componentType;
  }
  // Insert space before capital letters (except the first one)
  return componentType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

