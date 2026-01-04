# Component Properties Persistence and Memory Management

This document explains how custom/dynamic component property values are maintained in memory, persisted to disk, and reloaded when opening a project.

## Overview

The Component Properties dialog is now fully data-driven, rendering fields based on definitions in `componentDefinitions.json`. All component property values are stored directly on the component object itself, allowing for complete persistence and restoration.

## 1. In-Memory Storage

### Component State Structure

Components are stored in React state as arrays:
- `componentsTop: PCBComponent[]` - Components on the top layer
- `componentsBottom: PCBComponent[]` - Components on the bottom layer

### Component Object Structure

Each component is a JavaScript object that includes:

**Base Properties** (from `PCBComponentBase` interface):
- `id: string` - Unique identifier
- `componentType: ComponentType` - Type of component (e.g., 'Resistor', 'Capacitor', 'IntegratedCircuit')
- `designator: string` - PCB designator (e.g., "R1", "C5", "U3")
- `layer: 'top' | 'bottom'` - Which layer the component is on
- `x: number, y: number` - Position coordinates
- `pinCount: number` - Number of pins
- `pinConnections: string[]` - Array of connected node IDs
- `componentDefinitionKey?: string` - **Key linking to component definition** (format: `"category:subcategory:type"`)

**Dynamic Properties** (from field definitions in `componentDefinitions.json`):
- Any property defined in the component's field definitions
- For fields with units: `fieldName` (value) and `fieldNameUnit` (unit)
- Examples:
  - Resistor: `resistance`, `resistanceUnit`, `power`, `tolerance`
  - Capacitor: `capacitance`, `capacitanceUnit`, `voltage`, `voltageUnit`, `tolerance`, `dielectric`
  - Op Amp: `inputOffsetVoltage`, `inputOffsetVoltageUnit`, `gbw`, `gbwUnit`, `manufacturer`, `partNumber`, etc.

**Special Properties**:
- `description?: string` - Component description (available for all components)
- `datasheetFileName?: string` - Path to datasheet file (for Integrated Circuits/Semiconductors)
- `pinData?: Array<{name: string, type?: string}>` - Pin information from AI extraction
- `pinNames?: string[]` - Pin names array (for backward compatibility)

### Key Point: Dynamic Properties

Components use TypeScript's type system with `as any` casting to allow dynamic properties. When a component is created or updated:

1. **Component Creation** (`src/utils/components.ts:createComponent`):
   - Base properties are set from `PCBComponentBase`
   - `componentDefinitionKey` is stored: `"category:subcategory:type"`
   - Default field values from `componentDefinitions.json` are applied:
     ```typescript
     componentDef.fields.forEach((field) => {
       if (field.defaultValue !== undefined) {
         (baseComponent as any)[field.name] = field.defaultValue;
       }
       if (field.units && field.defaultUnit) {
         (baseComponent as any)[`${field.name}Unit`] = field.defaultUnit;
       }
     });
     ```

2. **Component Updates** (`src/components/ComponentEditor/ComponentEditor.tsx:updateComponent`):
   - Iterates over field definitions from `componentDefinitions.json`
   - Saves values from `componentEditor` state to the component object:
     ```typescript
     for (const field of fields) {
       const valueKey = field.name;
       const unitKey = `${field.name}Unit`;
       // Save value and unit to component object
       (updated as any)[valueKey] = value;
       (updated as any)[unitKey] = unit;
     }
     ```

## 2. Persistence (Saving to Disk)

### Save Process

When saving a project (`File -> Save Project` or auto-save):

1. **Build Project Data** (`src/App.tsx:buildProjectData`):
   ```typescript
   const project = {
     // ... other project data ...
     drawing: {
       componentsTop,      // Entire component objects serialized
       componentsBottom,   // Entire component objects serialized
       // ... other drawing data ...
     },
     // ... other project settings ...
   };
   ```

2. **JSON Serialization**:
   - `JSON.stringify(project, null, 2)` serializes the entire project object
   - **All properties on component objects are included** in the JSON
   - This includes:
     - Base properties (id, x, y, designator, etc.)
     - Dynamic properties (resistance, capacitance, voltage, etc.)
     - Unit properties (resistanceUnit, capacitanceUnit, etc.)
     - `componentDefinitionKey` (critical for reloading)

3. **File Write**:
   - JSON is written to: `{projectName}_{timestamp}.json`
   - Located in the project directory root
   - Old project files are moved to `history/` subdirectory

### Example JSON Structure

```json
{
  "drawing": {
    "componentsTop": [
      {
        "id": "comp_123",
        "componentType": "Resistor",
        "designator": "R1",
        "x": 100.5,
        "y": 200.3,
        "pinCount": 2,
        "componentDefinitionKey": "Resistors:Standard:Resistor",
        "resistance": "10",
        "resistanceUnit": "kΩ",
        "power": "1/4",
        "tolerance": "±5%",
        "manufacturer": "Vishay",
        "partNumber": "CRCW080510K0FKEA"
      },
      {
        "id": "comp_456",
        "componentType": "IntegratedCircuit",
        "designator": "U1",
        "x": 300.0,
        "y": 400.0,
        "pinCount": 8,
        "componentDefinitionKey": "Semiconductors:Dual Op Amp:Semiconductor",
        "manufacturer": "Texas Instruments",
        "partNumber": "LM358",
        "icType": "Op-Amp",
        "inputOffsetVoltage": "2",
        "inputOffsetVoltageUnit": "mV",
        "gbw": "1",
        "gbwUnit": "MHz",
        "datasheetFileName": "datasheets/LM358.pdf"
      }
    ],
    "componentsBottom": []
  }
}
```

## 3. Reloading (Opening a Project)

### Load Process

When opening a project (`File -> Open Project`):

1. **File Read** (`src/utils/projectOperations/projectOperations.ts:openProject`):
   - Finds the most recent JSON file in the project directory
   - Reads and parses: `JSON.parse(fileText)`

2. **Component Restoration** (`src/App.tsx:loadProject`):
   ```typescript
   if (project.drawing?.componentsTop) {
     const compsTop = (project.drawing.componentsTop as PCBComponent[]).map(comp => {
       return {
         ...comp,  // Spread operator preserves ALL properties
         x: truncatedPos.x,
         y: truncatedPos.y,
         layer: comp.layer || 'top',
         pinConnections: comp.pinConnections || new Array(comp.pinCount || 0).fill(''),
       };
     });
     setComponentsTop(compsTop);
   }
   ```

3. **Property Preservation**:
   - The spread operator (`...comp`) preserves **all properties** from the JSON
   - This includes:
     - All base properties
     - All dynamic properties (resistance, capacitance, voltage, etc.)
     - All unit properties
     - `componentDefinitionKey` (critical!)

4. **Definition Resolution**:
   - When the Component Properties dialog opens, it uses `componentDefinitionKey` to resolve the definition:
     ```typescript
     const def = resolveComponentDefinition(comp);
     // Uses componentDefinitionKey: "category:subcategory:type"
     // Falls back to heuristics if key is missing
     ```
   - The resolved definition determines which fields to render

5. **Field Population**:
   - `ComponentTypeFields` reads values from the component object:
     ```typescript
     const value = (componentEditor as any)[valueKey] ?? 
                   (comp as any)[valueKey] ?? 
                   field.defaultValue ?? '';
     ```
   - Values are displayed in the dialog fields

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Creation                        │
│  createComponent() → Sets componentDefinitionKey           │
│                  → Applies default field values             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              In-Memory Component Object                      │
│  {                                                           │
│    id, componentType, designator, x, y, ...                 │
│    componentDefinitionKey: "Resistors:Standard:Resistor",   │
│    resistance: "10", resistanceUnit: "kΩ",                  │
│    power: "1/4", tolerance: "±5%", ...                      │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              User Edits in Component Dialog                  │
│  ComponentTypeFields renders fields from definition          │
│  User changes values → componentEditor state updated         │
│  Save button → updateComponent() saves to component object   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Project Save                              │
│  buildProjectData() → componentsTop/Bottom arrays           │
│  JSON.stringify() → All component properties serialized     │
│  Write to: {projectName}_{timestamp}.json                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Project Load                              │
│  JSON.parse() → Restore component objects                    │
│  setComponentsTop/Bottom() → All properties preserved       │
│  componentDefinitionKey used to resolve definition          │
│  ComponentTypeFields renders fields with saved values       │
└─────────────────────────────────────────────────────────────┘
```

## 5. Critical Properties for Persistence

### `componentDefinitionKey`

**Format**: `"category:subcategory"`

**Examples**:
- `"Resistors:Standard"`
- `"Capacitors:Electrolytic"`
- `"Semiconductors:Dual Op Amp"`

**Purpose**:
- Links the component instance to its definition in `componentDefinitions.json`
- Used to determine which fields to render in the Component Properties dialog
- Ensures correct field rendering after project reload

**Storage**:
- Set when component is created (from `metadata.componentDefinition`)
- Stored on component object: `(baseComponent as any).componentDefinitionKey = defKey`
- Persisted in JSON: `component.componentDefinitionKey`
- Restored when loading: Preserved via spread operator

### Dynamic Field Properties

**Naming Convention**:
- Field value: `fieldName` (e.g., `resistance`, `capacitance`, `voltage`)
- Field unit: `fieldNameUnit` (e.g., `resistanceUnit`, `capacitanceUnit`, `voltageUnit`)

**Storage**:
- Stored directly on component object as properties
- No separate mapping or lookup table needed
- All properties serialized to JSON automatically

## 6. Backward Compatibility

### Legacy Components

Components created before the data-driven refactoring may:
- Not have `componentDefinitionKey` set
- Have properties stored in different formats

**Resolution**:
- `resolveComponentDefinition()` uses fallback heuristics:
  1. Try `componentDefinitionKey` (if present)
  2. Try designator prefix matching
  3. Try `componentType` + discriminator properties (e.g., `capacitorType`, `diodeType`)
  4. Default to first matching definition

### Migration

When a component is loaded without `componentDefinitionKey`:
- Definition is resolved using heuristics
- Component continues to work
- Next save will include `componentDefinitionKey` (if component is edited and saved)

## 7. Summary

**In Memory**:
- Components stored as JavaScript objects in React state arrays
- All properties (base + dynamic) stored directly on the object
- `componentDefinitionKey` links to field definitions

**Persistence**:
- Entire component objects serialized to JSON
- All properties automatically included
- Saved to `{projectName}_{timestamp}.json`

**Reloading**:
- JSON parsed and component objects restored
- All properties preserved via spread operator
- `componentDefinitionKey` used to resolve field definitions
- Fields populated from component object properties

**Key Insight**: The system uses a **"store everything"** approach - all component properties are stored directly on the component object, making persistence automatic and transparent. The `componentDefinitionKey` ensures the correct fields are rendered, but the actual property values are stored independently and persist regardless of definition changes.
