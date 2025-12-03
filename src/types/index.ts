// ============================================================================
// PCB Image Types
// ============================================================================

export interface PCBImage {
  url: string;
  name: string;
  width: number;
  height: number;
  // Persistable image content for Save/Load (data URL) - kept for backward compatibility
  dataUrl?: string;
  // File path relative to project directory (preferred for new projects)
  filePath?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  // Skew (keystone) angles in radians; applied as affine shear
  skewX?: number;
  skewY?: number;
  // Keystone (perspective-like taper) in radians for vertical and horizontal
  keystoneV?: number;
  keystoneH?: number;
  bitmap?: ImageBitmap | null;
}

// ============================================================================
// Drawing Types
// ============================================================================

export interface DrawingPoint {
  id: number; // globally unique point ID (used for netlist connections)
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via' | 'pad' | 'testPoint';
  notes?: string | null; // Max 200 characters, null until user enters a value
  testPointType?: 'power' | 'ground' | 'signal' | 'unknown'; // For test points only
}

// ============================================================================
// PCB Element Types
// ============================================================================

export interface Via {
  id: string; // stroke ID (for deletion/selection tracking)
  pointId?: number; // globally unique point ID (for netlist connections)
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface TraceSegment {
  id: string; // stroke ID (for deletion/selection tracking)
  startPointId?: number; // globally unique point ID for start point (for netlist connections)
  endPointId?: number; // globally unique point ID for end point (for netlist connections)
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  size: number;
  color: string;
  layer: 'top' | 'bottom';
}

// ============================================================================
// Component Type System
// ============================================================================

/**
 * Base interface for all PCB components
 */
export interface PCBComponentBase {
  id: string;
  componentType: ComponentType;
  designator: string; // e.g., "U1", "R5", "C3"
  layer: 'top' | 'bottom';
  x: number;
  y: number;
  color: string;
  size: number; // visual size of icon
  packageType?: string; // e.g., "SOT-23", "DIP-8"
  partMarkings?: string; // markings on the component
  pinCount: number;
  pinConnections: string[]; // Array of node IDs (size = pinCount)
  pinPolarities?: ('+' | '-' | '')[]; // Array of pin polarities (size = pinCount), only for components with polarity (electrolytic caps, diodes, batteries, etc.)
  notes?: string | null; // Max 200 characters, null until user enters a value
  orientation?: number; // Rotation in degrees: 0, 90, 180, 270 (for components with required orientation like electrolytic caps, ICs with PIN #1)
  description?: string; // Component description
}

/**
 * Component type enumeration based on standard PCB designator prefixes
 */
export type ComponentType =
  | 'Battery'           // B, BT
  | 'Capacitor'         // C (general)
  | 'Electrolytic Capacitor' // C (electrolytic - has polarity)
  | 'Film Capacitor'    // C, CF (film - non-polarized)
  | 'Diode'             // D, CR (including Zener and LEDs)
  | 'Fuse'              // F
  | 'FerriteBead'       // FB
  | 'Connector'         // J, P
  | 'Jumper'            // JP
  | 'Relay'             // K
  | 'Inductor'          // L
  | 'Speaker'           // LS
  | 'Motor'             // M
  | 'PowerSupply'       // PS
  | 'Transistor'        // Q (BJT, FET, MOSFET)
  | 'Resistor'          // R
  | 'ResistorNetwork'   // RN
  | 'Thermistor'        // RT
  | 'Switch'            // S, SW
  | 'Transformer'       // T
  | 'TestPoint'         // TP
  | 'IntegratedCircuit' // U, IC
  | 'VacuumTube'        // V
  | 'VariableResistor'  // VR (potentiometer, varistor, voltage regulator)
  | 'Crystal'           // X, XTAL, Y
  | 'ZenerDiode';       // Z

/**
 * Battery or Cell (B, BT)
 */
export interface Battery extends PCBComponentBase {
  componentType: 'Battery';
  voltage?: string; // value only, e.g., "3.7", "9"
  voltageUnit?: string; // unit, e.g., "V"
  capacity?: string; // value only, e.g., "2000"
  capacityUnit?: string; // unit, e.g., "mAh"
  chemistry?: string; // e.g., "Li-ion", "Alkaline"
}

/**
 * Capacitor (C) - General purpose (ceramic, film, etc.)
 */
export interface Capacitor extends PCBComponentBase {
  componentType: 'Capacitor';
  capacitance?: string; // value only, e.g., "100"
  capacitanceUnit?: string; // unit, e.g., "nF"
  voltage?: string; // value only, e.g., "50"
  voltageUnit?: string; // unit, e.g., "V"
  tolerance?: string; // e.g., "±10%"
  dielectric?: string; // e.g., "Ceramic", "Film", "Tantalum"
}

/**
 * Electrolytic Capacitor (C) - Has polarity, requires orientation
 */
export interface ElectrolyticCapacitor extends PCBComponentBase {
  componentType: 'Electrolytic Capacitor';
  capacitance?: string; // value only, e.g., "100"
  capacitanceUnit?: string; // unit, e.g., "µF"
  voltage?: string; // value only, e.g., "25"
  voltageUnit?: string; // unit, e.g., "V"
  tolerance?: string; // e.g., "±20%"
  polarity?: 'Positive' | 'Negative'; // which pin is positive (important for orientation)
  esr?: string; // value only, e.g., "50"
  esrUnit?: string; // unit, e.g., "mΩ"
  temperature?: string; // operating temperature range, e.g., "-40°C to +85°C"
}

/**
 * Film Capacitor (C, CF) - Non-polarized film capacitor
 */
export interface FilmCapacitor extends PCBComponentBase {
  componentType: 'Film Capacitor';
  capacitance?: string; // value only, e.g., "100"
  capacitanceUnit?: string; // unit, e.g., "nF", "µF"
  voltage?: string; // value only, e.g., "50"
  voltageUnit?: string; // unit, e.g., "V"
  tolerance?: string; // e.g., "±10%"
  filmType?: string; // e.g., "Polyester", "Polypropylene", "Polyethylene"
}

/**
 * Diode (D, CR) - includes Zener diodes and LEDs
 */
export interface Diode extends PCBComponentBase {
  componentType: 'Diode';
  diodeType?: 'Standard' | 'Zener' | 'LED' | 'Schottky' | 'Other';
  partNumber?: string;
  voltage?: string; // value only
  voltageUnit?: string; // unit, e.g., "V"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
  ledColor?: string; // for LEDs (wavelength/color like "red", "blue", "650nm")
}

/**
 * Fuse (F)
 */
export interface Fuse extends PCBComponentBase {
  componentType: 'Fuse';
  current?: string; // value only, e.g., "1"
  currentUnit?: string; // unit, e.g., "A"
  voltage?: string; // value only
  voltageUnit?: string; // unit, e.g., "V"
  fuseType?: string; // e.g., "Fast-blow", "Slow-blow"
}

/**
 * Ferrite Bead (FB)
 */
export interface FerriteBead extends PCBComponentBase {
  componentType: 'FerriteBead';
  impedance?: string; // value only, e.g., "100"
  impedanceUnit?: string; // unit, e.g., "Ω"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
}

/**
 * Connector or Jack/Plug (J, P)
 */
export interface Connector extends PCBComponentBase {
  componentType: 'Connector';
  connectorType?: string; // e.g., "USB", "Header", "JST"
  gender?: 'Male' | 'Female' | 'N/A';
}

/**
 * Jumper (JP)
 */
export interface Jumper extends PCBComponentBase {
  componentType: 'Jumper';
  positions?: number; // number of positions
}

/**
 * Relay or Contactor (K)
 */
export interface Relay extends PCBComponentBase {
  componentType: 'Relay';
  coilVoltage?: string; // value only, e.g., "5"
  coilVoltageUnit?: string; // unit, e.g., "V"
  contactType?: string; // e.g., "SPDT", "DPDT"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
}

/**
 * Inductor or Coil (L)
 */
export interface Inductor extends PCBComponentBase {
  componentType: 'Inductor';
  inductance?: string; // value only, e.g., "10"
  inductanceUnit?: string; // unit, e.g., "µH"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
  resistance?: string; // value only
  resistanceUnit?: string; // unit, e.g., "Ω"
}

/**
 * Loudspeaker or Buzzer (LS)
 */
export interface Speaker extends PCBComponentBase {
  componentType: 'Speaker';
  impedance?: string; // value only, e.g., "8"
  impedanceUnit?: string; // unit, e.g., "Ω"
  power?: string; // combined value+unit (e.g., "1/4W", "1W") since unit is always W
}

/**
 * Motor (M)
 */
export interface Motor extends PCBComponentBase {
  componentType: 'Motor';
  motorType?: string; // e.g., "DC", "Stepper", "Servo"
  voltage?: string; // value only
  voltageUnit?: string; // unit, e.g., "V"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
}

/**
 * Power Supply (PS)
 */
export interface PowerSupply extends PCBComponentBase {
  componentType: 'PowerSupply';
  inputVoltage?: string; // value only
  inputVoltageUnit?: string; // unit, e.g., "V"
  outputVoltage?: string; // value only
  outputVoltageUnit?: string; // unit, e.g., "V"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
}

/**
 * Transistor (Q) - BJT, FET, MOSFET
 */
export interface Transistor extends PCBComponentBase {
  componentType: 'Transistor';
  transistorType?: 'BJT' | 'FET' | 'MOSFET' | 'JFET' | 'Other';
  polarity?: 'NPN' | 'PNP' | 'N-Channel' | 'P-Channel';
  partNumber?: string;
  voltage?: string; // value only
  voltageUnit?: string; // unit, e.g., "V"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
}

/**
 * Resistor (R)
 */
export interface Resistor extends PCBComponentBase {
  componentType: 'Resistor';
  resistance?: string; // value only, e.g., "10"
  resistanceUnit?: string; // unit, e.g., "kΩ"
  power?: string; // combined value+unit (e.g., "1/4W", "1W") since unit is always W
  tolerance?: string; // e.g., "±5%"
}

/**
 * Resistor Network (RN)
 */
export interface ResistorNetwork extends PCBComponentBase {
  componentType: 'ResistorNetwork';
  resistance?: string; // value only
  resistanceUnit?: string; // unit, e.g., "Ω"
  configuration?: string; // e.g., "Isolated", "Bussed"
}

/**
 * Thermistor (RT)
 */
export interface Thermistor extends PCBComponentBase {
  componentType: 'Thermistor';
  resistance?: string; // value only
  resistanceUnit?: string; // unit, e.g., "Ω"
  thermistorType?: 'NTC' | 'PTC';
  beta?: string; // beta value (no unit)
}

/**
 * Switch (S, SW)
 */
export interface Switch extends PCBComponentBase {
  componentType: 'Switch';
  switchType?: string; // e.g., "SPST", "DPDT", "Momentary"
  current?: string; // value only
  currentUnit?: string; // unit, e.g., "A"
  voltage?: string; // value only
  voltageUnit?: string; // unit, e.g., "V"
}

/**
 * Transformer (T)
 */
export interface Transformer extends PCBComponentBase {
  componentType: 'Transformer';
  primaryVoltage?: string; // value only
  primaryVoltageUnit?: string; // unit, e.g., "V"
  secondaryVoltage?: string; // value only
  secondaryVoltageUnit?: string; // unit, e.g., "V"
  power?: string; // combined value+unit (e.g., "1/4W", "1W") since unit is always W
  turns?: string; // turns ratio (no unit)
}

/**
 * Test Point (TP)
 */
export interface TestPoint extends PCBComponentBase {
  componentType: 'TestPoint';
  signal?: string; // signal name or purpose
}

/**
 * Integrated Circuit (U, IC)
 */
export interface IntegratedCircuit extends PCBComponentBase {
  componentType: 'IntegratedCircuit';
  manufacturer?: string;
  partNumber?: string;
  description?: string;
  datasheet?: string; // URL to datasheet
  icType?: string; // e.g., "Microcontroller", "Op-Amp", "Voltage Regulator"
}

/**
 * Vacuum Tube (V)
 */
export interface VacuumTube extends PCBComponentBase {
  componentType: 'VacuumTube';
  tubeType?: string;
  partNumber?: string;
}

/**
 * Variable Resistor (VR) - Potentiometer, Varistor, Voltage Regulator
 */
export interface VariableResistor extends PCBComponentBase {
  componentType: 'VariableResistor';
  vrType?: 'Potentiometer' | 'Varistor' | 'VoltageRegulator';
  resistance?: string; // value only
  resistanceUnit?: string; // unit, e.g., "Ω"
  power?: string; // combined value+unit (e.g., "1/4W", "1W") since unit is always W
  taper?: string; // for potentiometers: "Linear", "Logarithmic"
}

/**
 * Crystal or Oscillator (X, XTAL, Y)
 */
export interface Crystal extends PCBComponentBase {
  componentType: 'Crystal';
  frequency?: string; // e.g., "16MHz", "32.768kHz"
  loadCapacitance?: string;
  tolerance?: string;
}

/**
 * Zener Diode (Z)
 */
export interface ZenerDiode extends PCBComponentBase {
  componentType: 'ZenerDiode';
  voltage?: string; // value only
  voltageUnit?: string; // unit, e.g., "V"
  power?: string; // combined value+unit (e.g., "1/4W", "1W") since unit is always W
  tolerance?: string;
}

/**
 * Union type for all component types
 */
export type PCBComponent =
  | Battery
  | Capacitor
  | ElectrolyticCapacitor
  | FilmCapacitor
  | Diode
  | Fuse
  | FerriteBead
  | Connector
  | Jumper
  | Relay
  | Inductor
  | Speaker
  | Motor
  | PowerSupply
  | Transistor
  | Resistor
  | ResistorNetwork
  | Thermistor
  | Switch
  | Transformer
  | TestPoint
  | IntegratedCircuit
  | VacuumTube
  | VariableResistor
  | Crystal
  | ZenerDiode;

export interface GroundSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  notes?: string | null; // Max 200 characters, null until user enters a value
}

export interface PowerNode {
  id: string;
  x: number;
  y: number;
  voltage: string; // e.g., "+5V", "-5V", "+3.3V", "+12V"
  color: string;
  size: number;
}

// ============================================================================
// View and Tool Types
// ============================================================================

export type ViewMode = 'top' | 'bottom' | 'overlay';

export type Tool = 
  | 'none' 
  | 'select' 
  | 'draw' 
  | 'erase' 
  | 'transform' 
  | 'magnify' 
  | 'pan' 
  | 'component' 
  | 'power'
  | 'ground'
  | 'center'
  | 'componentConnection';

export type TransformMode = 'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone';

// ============================================================================
// Layer Visibility Types
// ============================================================================

export interface LayerVisibility {
  topImage: boolean;
  bottomImage: boolean;
  vias: boolean;
  topTraces: boolean;
  bottomTraces: boolean;
  topComponents: boolean;
  bottomComponents: boolean;
  ground: boolean;
}

// ============================================================================
// Selection Types
// ============================================================================

export interface SelectionState {
  viaIds: Set<string>;
  traceIds: Set<string>;
  componentIds: Set<string>;
  groundIds: Set<string>;
}

// ============================================================================
// Project Save/Load Types
// ============================================================================

export interface ProjectData {
  version: string;
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  vias: Via[];
  tracesTop: DrawingStroke[];
  tracesBottom: DrawingStroke[];
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  grounds: GroundSymbol[];
  viewSettings: {
    currentView: ViewMode;
    transparency: number;
    viewScale: number;
    viewPanX: number;
    viewPanY: number;
  };
}

// ============================================================================
// Coordinate System Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
