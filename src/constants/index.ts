// ============================================================================
// Application Constants
// ============================================================================

export const APP_VERSION = '1.0.0';

// ============================================================================
// Canvas and Drawing Constants
// ============================================================================

export const CONTENT_BORDER = 40; // fixed border (in canvas pixels) where nothing is drawn
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
  // Row 1: Neutrals
  '#000000', '#3C3C3C', '#7F7F7F', '#BFBFBF',
  '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  
  // Row 2: Blues
  '#0072B2', '#56B4E9', '#00BFC4', '#332288',
  '#1F77B4', '#A6CEE3', '#17BECF', '#6A3D9A',
  
  // Row 3: Greens and Yellows
  '#009E73', '#B3DE69', '#E69F00', '#F0E442',
  '#2CA02C', '#B2DF8A', '#BCBD22', '#FFED6F',
  
  // Row 4: Reds, Pinks, and Browns
  '#E15759', '#D62728', '#FB9A99', '#CC79A7',
  '#AA4499', '#F781BF', '#9467BD', '#CAB2D6',
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
  COMPONENT: 'c',
  POWER: 'p',
  GROUND: 'g',
  ERASE: 'e',
  MOVE: 'h',
  ZOOM: 'z',
  UNDO: 'z', // with Cmd/Ctrl modifier
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
  DEFAULT_SIZE: 24,
  MIN_SIZE: 12,
  MAX_SIZE: 100,
};

// ============================================================================
// Component Type Metadata
// ============================================================================

export const COMPONENT_TYPE_INFO = {
  Battery: { prefix: ['B', 'BT'], defaultPins: 2 },
  Capacitor: { prefix: ['C'], defaultPins: 2 },
  Diode: { prefix: ['D', 'CR'], defaultPins: 2 },
  Fuse: { prefix: ['F'], defaultPins: 2 },
  FerriteBead: { prefix: ['FB'], defaultPins: 2 },
  Connector: { prefix: ['J', 'P'], defaultPins: 4 },
  Jumper: { prefix: ['JP'], defaultPins: 3 },
  Relay: { prefix: ['K'], defaultPins: 5 },
  Inductor: { prefix: ['L'], defaultPins: 2 },
  Speaker: { prefix: ['LS'], defaultPins: 2 },
  Motor: { prefix: ['M'], defaultPins: 2 },
  PowerSupply: { prefix: ['PS'], defaultPins: 4 },
  Transistor: { prefix: ['Q'], defaultPins: 3 },
  Resistor: { prefix: ['R'], defaultPins: 2 },
  ResistorNetwork: { prefix: ['RN'], defaultPins: 8 },
  Thermistor: { prefix: ['RT'], defaultPins: 2 },
  Switch: { prefix: ['S', 'SW'], defaultPins: 2 },
  Transformer: { prefix: ['T'], defaultPins: 4 },
  TestPoint: { prefix: ['TP'], defaultPins: 1 },
  IntegratedCircuit: { prefix: ['U', 'IC'], defaultPins: 8 },
  VacuumTube: { prefix: ['V'], defaultPins: 5 },
  VariableResistor: { prefix: ['VR'], defaultPins: 3 },
  Crystal: { prefix: ['X', 'XTAL', 'Y'], defaultPins: 2 },
  ZenerDiode: { prefix: ['Z'], defaultPins: 2 },
} as const;

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
  DEFAULT_SIZE: 26,
  MIN_SIZE: 4,
  MAX_SIZE: 40,
  INNER_CIRCLE_RATIO: 0.5, // inner circle is 50% of outer diameter
};

