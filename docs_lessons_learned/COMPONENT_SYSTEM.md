# PCB Component Type System

## Overview

The PCB Reverse Engineering Tool implements a comprehensive component type system based on standard PCB designator prefixes. This system supports 24 different component types, each with specific properties relevant to PCB reverse engineering and schematic generation.

## Component Workflow

### 1. Component Placement

When the user selects the Component tool:

1. **Layer Selection Dialog**
   - User chooses: Top Layer or Bottom Layer
   - Selection persists until tool is reselected

2. **Component Type Selection Dialog**
   - User chooses from 24 component types (see table below)
   - Each type has a standard designator prefix
   - Default pin count is suggested based on type

3. **Position Placement**
   - User clicks on drawing area to place component
   - Component icon appears at x,y position
   - Icon color reflects current color picker selection

4. **Properties Dialog (Immediate)**
   - Dialog appears automatically after placement
   - User enters component details
   - Suggested designator is pre-filled (e.g., U1, R5, C3)
   - User can modify all properties

### 2. Component Editing

Double-clicking an existing component:
- Opens the properties dialog
- Allows editing all component properties
- Allows editing pin connections
- Validates data on save

## Component Types

### Complete Type List (24 Types)

| Prefix | Component Type | Default Pins | Key Properties |
|--------|---------------|--------------|----------------|
| **B, BT** | Battery | 2 | Voltage, Capacity, Chemistry |
| **C** | Capacitor | 2 | Capacitance, Voltage Rating, Tolerance, Dielectric |
| **D, CR** | Diode | 2 | Type (Standard/Zener/LED/Schottky), Voltage, Current, Color |
| **F** | Fuse | 2 | Current Rating, Voltage Rating, Type |
| **FB** | Ferrite Bead | 2 | Impedance, Current Rating |
| **J, P** | Connector | 4 | Connector Type, Gender, Pin Count (variable) |
| **JP** | Jumper | 3 | Positions |
| **K** | Relay | 5 | Coil Voltage, Contact Type, Current Rating |
| **L** | Inductor | 2 | Inductance, Current, DC Resistance |
| **LS** | Speaker/Buzzer | 2 | Impedance, Power Rating |
| **M** | Motor | 2 | Motor Type, Voltage, Current |
| **PS** | Power Supply | 4 | Input Voltage, Output Voltage, Current |
| **Q** | Transistor | 3 | Type (BJT/FET/MOSFET), Polarity, Part Number, Ratings |
| **R** | Resistor | 2 | Resistance, Power Rating, Tolerance |
| **RN** | Resistor Network | 8 | Resistance, Configuration |
| **RT** | Thermistor | 2 | Resistance @ 25°C, Type (NTC/PTC), Beta Value |
| **S, SW** | Switch | 2 | Switch Type, Current, Voltage |
| **T** | Transformer | 4 | Primary/Secondary Voltage, Power, Turns Ratio |
| **TP** | Test Point | 1 | Signal Name |
| **U, IC** | Integrated Circuit | 8 | Manufacturer, Part Number, Description, Datasheet, IC Type |
| **V** | Vacuum Tube | 5 | Tube Type, Part Number |
| **VR** | Variable Resistor | 3 | Type (Pot/Varistor/Reg), Resistance, Power, Taper |
| **X, XTAL, Y** | Crystal | 2 | Frequency, Load Capacitance, Tolerance |
| **Z** | Zener Diode | 2 | Zener Voltage, Power Rating, Tolerance |

## Common Properties (All Components)

Every component includes these base properties:

```typescript
{
  id: string;                    // Unique identifier
  componentType: ComponentType;  // Type from the list above
  designator: string;            // e.g., "U1", "R5", "C3"
  layer: 'top' | 'bottom';       // PCB layer
  x: number;                     // X position
  y: number;                     // Y position
  color: string;                 // Display color
  size: number;                  // Visual icon size
  packageType?: string;          // e.g., "SOT-23", "DIP-8", "0805"
  partMarkings?: string;         // Physical markings on component
  pinCount: number;              // Number of pins/connections
  pinConnections: string[];      // Array of node IDs (size = pinCount)
  notes?: string;                // Additional notes
}
```

## Pin Connection System

### Pin Connections Array

Each component maintains an array of pin connections:
- **Size**: Equals `pinCount`
- **Content**: Node IDs (strings)
- **Empty String**: Indicates unconnected pin
- **Node Types**: Can reference vias, pads, power nodes, or ground nodes

### Example

```typescript
// Integrated circuit with 8 pins
{
  componentType: 'IntegratedCircuit',
  designator: 'U1',
  pinCount: 8,
  pinConnections: [
    'via-123',      // Pin 1 connected to via-123
    'via-456',      // Pin 2 connected to via-456
    '',             // Pin 3 unconnected
    'ground-789',   // Pin 4 connected to ground
    'power-012',    // Pin 5 connected to +5V power
    'via-345',      // Pin 6 connected to via-345
    '',             // Pin 7 unconnected
    'via-678',      // Pin 8 connected to via-678
  ]
}
```

### Pin Count Management

When pin count changes:
1. Create new array of size `newPinCount`
2. Copy existing connections (up to min of old/new size)
3. Initialize remaining pins as empty strings
4. Update component's `pinCount` property

## Type-Specific Properties

### Integrated Circuit (Most Complex)

```typescript
{
  // Base properties...
  componentType: 'IntegratedCircuit',
  manufacturer?: string;      // e.g., "Texas Instruments"
  partNumber?: string;        // e.g., "TL072"
  description?: string;       // e.g., "Dual Op-Amp"
  datasheet?: string;         // URL to datasheet
  icType?: string;            // e.g., "Op-Amp", "Microcontroller"
}
```

### Resistor (Simple Example)

```typescript
{
  // Base properties...
  componentType: 'Resistor',
  resistance?: string;        // e.g., "10kΩ", "100Ω"
  power?: string;             // e.g., "1/4W", "1W"
  tolerance?: string;         // e.g., "±5%", "±1%"
}
```

### Transistor (Medium Complexity)

```typescript
{
  // Base properties...
  componentType: 'Transistor',
  transistorType?: 'BJT' | 'FET' | 'MOSFET' | 'JFET' | 'Other';
  polarity?: 'NPN' | 'PNP' | 'N-Channel' | 'P-Channel';
  partNumber?: string;
  voltage?: string;           // Max voltage rating
  current?: string;           // Max current rating
}
```

## Properties Dialog

### Dialog Layout

```
┌─────────────────────────────────────────────┐
│ Component Properties: [Type]                │
├─────────────────────────────────────────────┤
│ Common Properties:                          │
│   Designator:    [U1_____________]          │
│   Package Type:  [DIP-8__________]          │
│   Part Markings: [TL072__________]          │
│   Pin Count:     [8___]                     │
│   Notes:         [________________]         │
│                                             │
│ Type-Specific Properties:                   │
│   Manufacturer:  [Texas Instruments]        │
│   Part Number:   [TL072__________]          │
│   Description:   [Dual Op-Amp____]          │
│   IC Type:       [Op-Amp_________]          │
│                                             │
│ Pin Connections:                            │
│   ┌───┬──────────────┬──────────┐          │
│   │Pin│ Node ID      │ Type     │          │
│   ├───┼──────────────┼──────────┤          │
│   │ 1 │ via-123      │ Via      │          │
│   │ 2 │ via-456      │ Via      │          │
│   │ 3 │              │ -        │          │
│   │ 4 │ ground-789   │ Ground   │          │
│   │ 5 │ power-012    │ Power    │          │
│   │ 6 │ via-345      │ Via      │          │
│   │ 7 │              │ -        │          │
│   │ 8 │ via-678      │ Via      │          │
│   └───┴──────────────┴──────────┘          │
│                                             │
│           [Save]  [Cancel]                  │
└─────────────────────────────────────────────┘
```

### Validation

The dialog validates:
- ✓ Designator is not empty
- ✓ Designator is unique within project
- ✓ Pin count is positive
- ⚠ Node IDs reference existing nodes (warning if not found)

## Designator Auto-Suggestion

When creating a new component:

1. **Determine Prefix**: Based on component type (e.g., "U" for IC)
2. **Find Highest Number**: Scan existing components of same type
3. **Suggest Next**: Increment highest number by 1
4. **Example**: If U1, U2, U3 exist → suggest U4

```typescript
// Example usage
suggestNextDesignator('IntegratedCircuit', existingComponents)
// Returns: "U4" (if U1, U2, U3 exist)
```

## BOM (Bill of Materials) Export

### BOM Entry Format

```typescript
{
  designator: string;        // e.g., "U1"
  componentType: string;     // e.g., "IntegratedCircuit"
  packageType?: string;      // e.g., "DIP-8"
  partMarkings?: string;     // e.g., "TL072"
  partNumber?: string;       // e.g., "TL072CN"
  value?: string;            // e.g., "10kΩ" (for resistors, etc.)
  manufacturer?: string;     // e.g., "Texas Instruments"
  description?: string;      // e.g., "Dual Op-Amp"
  pinCount: number;          // e.g., 8
  layer: string;             // "top" or "bottom"
  notes?: string;            // Additional notes
}
```

### BOM Export Features

- **Sorting**: Alphanumeric by designator (R1, R2, R10, U1, U2)
- **Filtering**: Only placed components with designators
- **Formats**: CSV or JSON
- **Warnings**: Components without designators are excluded with warning

### Example BOM Output (CSV)

```csv
Designator,Type,Package,Part Number,Value,Manufacturer,Pins,Layer
C1,Capacitor,0805,,"100nF",,2,top
C2,Capacitor,0805,,"10uF",,2,top
R1,Resistor,0805,,"10kΩ",,2,top
R2,Resistor,0805,,"1kΩ",,2,top
U1,IntegratedCircuit,DIP-8,TL072CN,,Texas Instruments,8,top
```

## Implementation Files

### Type Definitions
- **File**: `src/types/index.ts`
- **Content**: 24 component type interfaces + base interface + union type

### Constants
- **File**: `src/constants/index.ts`
- **Content**: `COMPONENT_TYPE_INFO` with prefixes and default pin counts

### Utilities
- **File**: `src/utils/components.ts`
- **Functions**:
  - `createComponent()` - Create new component with defaults
  - `updatePinConnections()` - Resize pin connections array
  - `setPinConnection()` - Set a pin connection
  - `clearPinConnection()` - Clear a pin connection
  - `getConnectedNodes()` - Get all connected node IDs
  - `hasConnections()` - Check if component has any connections
  - `getComponentDisplayName()` - Get display name
  - `validateComponent()` - Validate component data
  - `suggestNextDesignator()` - Auto-suggest designator
  - `componentToBOM()` - Convert component to BOM entry
  - `exportBOM()` - Export all components to BOM

## Usage Examples

### Creating a Component

```typescript
import { createComponent } from './utils/components';

// Create a resistor on top layer at position (100, 200)
const resistor = createComponent(
  'Resistor',
  'top',
  100,
  200,
  '#ff0000',
  24
);

// Result:
// {
//   id: 'comp-1234567890-abc',
//   componentType: 'Resistor',
//   designator: '',
//   layer: 'top',
//   x: 100,
//   y: 200,
//   color: '#ff0000',
//   size: 24,
//   pinCount: 2,
//   pinConnections: ['', ''],
// }
```

### Setting Pin Connections

```typescript
import { setPinConnection } from './utils/components';

// Connect pin 1 to via-123
const updated = setPinConnection(resistor, 0, 'via-123');

// Connect pin 2 to via-456
const final = setPinConnection(updated, 1, 'via-456');

// Result:
// pinConnections: ['via-123', 'via-456']
```

### Updating Pin Count

```typescript
import { updatePinConnections } from './utils/components';

// Change IC from 8 pins to 16 pins
const expanded = updatePinConnections(ic, 16);

// Existing connections are preserved
// New pins are initialized as empty strings
```

### Exporting BOM

```typescript
import { exportBOM } from './utils/components';

const allComponents = [resistor1, resistor2, ic1, capacitor1];
const bom = exportBOM(allComponents);

// Result: Array of BOM entries sorted by designator
```

## Future Enhancements

1. **Component Library**: Pre-defined component templates
2. **Footprint Matching**: Link to KiCad footprints
3. **Parametric Search**: Search components by properties
4. **Datasheet Integration**: Fetch datasheets automatically
5. **Schematic Symbol**: Associate with KiCad schematic symbols
6. **Net Validation**: Validate pin connections form valid nets
7. **DRC (Design Rule Check)**: Validate component placement
8. **3D Models**: Associate with 3D models for visualization

