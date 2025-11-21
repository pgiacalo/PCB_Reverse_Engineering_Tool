# KiCad Schematic Requirements Analysis

## Current Implementation Status

### ✅ **What We CAN Produce (Currently Implemented)**

#### 1. **Components** ✅
- **Reference Designator**: ✅ Stored in `component.designator` (e.g., "R1", "C2", "U3")
- **Component Type**: ✅ Stored in `component.componentType` (e.g., "Resistor", "Capacitor", "IntegratedCircuit")
- **Symbol Library Mapping**: ✅ Basic mapping exists (`simple:Resistor`, `simple:Capacitor`, `simple:IC`, `simple:Generic`)
- **Pin Count**: ✅ Stored in `component.pinCount`
- **Component Positions**: ✅ X, Y coordinates stored and used for schematic layout
- **Rotation/Orientation**: ✅ Stored in `component.orientation` (0°, 90°, 180°, 270°) and used in schematic

#### 2. **Connections (Nets)** ✅
- **Node IDs**: ✅ Globally unique IDs connecting component pins to vias/pads/traces
- **Net Grouping**: ✅ Union-find algorithm groups connected nodes into nets
- **Net Names**: ✅ Generated (power nets use voltage, ground uses "GND", signals use "N$1", "N$2", etc.)
- **Wire Connections**: ✅ Wires generated between component pins in the same net
- **Power/Ground Symbols**: ✅ Power and ground symbols placed and connected

#### 3. **Polarity** ⚠️ **PARTIALLY IMPLEMENTED**
- **Pin Polarity Data**: ✅ Stored in `component.pinPolarities` array (`'+'`, `'-'`, or `''`)
- **Auto-Assignment**: ✅ Automatic polarity assignment based on `+` symbol position relative to connected vias
- **Polarity in Schematic**: ❌ **NOT USED** - `pinPolarities` is not checked when generating schematic symbols
- **Polarity Indicators**: ❌ KiCad symbols don't reflect polarity (e.g., electrolytic cap should show `+` pin)

#### 4. **Geometric Relationships** ⚠️ **PARTIALLY IMPLEMENTED**
- **Component Positions**: ✅ X, Y coordinates preserved
- **Pin Positions**: ✅ Calculated based on component type and pin count
- **Rotation**: ✅ Component rotation applied to schematic symbols
- **PCB Layout Preservation**: ❌ Components placed in grid, not preserving relative PCB positions
- **Pin Mapping Accuracy**: ⚠️ Pin numbers may not match physical component pin #1 correctly

### ❌ **What is MISSING**

#### 1. **Component Values** ❌
**Current State**: 
- Line 621 in `schematic.ts` sets `Value` property to `comp.componentType` (e.g., "Resistor", "Capacitor")
- Should use actual values like "10kΩ", "100nF", "TL072", etc.

**Missing Data Extraction**:
- `resistance` field exists but not used in schematic
- `capacitance` field exists but not used in schematic  
- `inductance` field exists but not used in schematic
- `partNumber` field exists but not used in schematic
- `voltage`, `current`, `power` fields exist but not used

**Impact**: KiCad schematics show generic component types instead of actual values.

#### 2. **Polarity in Schematic** ❌
**Current State**:
- `pinPolarities` array is populated and stored
- Polarity is NOT used when generating KiCad symbols

**Missing Implementation**:
- Need to check `pinPolarities` when placing components
- For polarized components (electrolytic caps, diodes, batteries):
  - Pin with `'+'` polarity should connect to positive terminal
  - Pin with `'-'` polarity should connect to negative terminal
  - Symbol orientation should reflect correct polarity

**Impact**: Polarity-sensitive components may be wired incorrectly in KiCad.

#### 3. **Geometric Relationships** ❌
**Current State**:
- Components placed in a grid layout (lines 292-318 in `schematic.ts`)
- Relative PCB positions are NOT preserved

**Missing Implementation**:
- Need to scale and translate PCB coordinates to schematic coordinates
- Preserve component-to-component spatial relationships
- Maintain relative positioning from PCB layout

**Impact**: Schematic doesn't reflect the physical layout relationships, making it harder to correlate with PCB.

#### 4. **Component Footprints** ⚠️
**Current State**:
- `packageType` field exists but not used in schematic generation
- Footprint information is only used in netlist generation

**Missing Implementation**:
- Add footprint property to schematic symbols (optional but recommended)

#### 5. **Pin Number Accuracy** ⚠️
**Current State**:
- Pin numbers are sequential (1, 2, 3...) based on `pinCount`
- For ICs, pin #1 position is calculated but may not match physical component

**Missing Implementation**:
- Need to ensure pin #1 mapping is correct for ICs
- Use `orientation` to correctly map pin positions

#### 6. **Additional Component Properties** ⚠️
**Current State**:
- Many component-specific fields exist (voltage, current, power, tolerance, etc.)
- These are NOT used in schematic generation

**Missing Implementation**:
- Could add additional properties to schematic symbols (e.g., voltage rating, power rating)

## Action Items to Complete Implementation

### Priority 1: **Component Values** (High Impact, Easy Fix)

**File**: `src/utils/schematic.ts` (around line 621)

**Current Code**:
```typescript
schematic += `    (property "Value" "${comp.componentType}" (id 1) ...`;
```

**Fix**: Create a helper function similar to `getComponentValue` in `netlist.ts`:

```typescript
function getComponentValueForSchematic(comp: PCBComponent): string {
  // For Resistor: use resistance
  if (comp.componentType === 'Resistor' && 'resistance' in comp) {
    return (comp as any).resistance || comp.componentType;
  }
  // For Capacitor: use capacitance
  if (comp.componentType === 'Capacitor' && 'capacitance' in comp) {
    return (comp as any).capacitance || comp.componentType;
  }
  // For Electrolytic Capacitor: use capacitance
  if (comp.componentType === 'Electrolytic Capacitor' && 'capacitance' in comp) {
    return (comp as any).capacitance || comp.componentType;
  }
  // For Inductor: use inductance
  if (comp.componentType === 'Inductor' && 'inductance' in comp) {
    return (comp as any).inductance || comp.componentType;
  }
  // For ICs, Transistors, Diodes: use partNumber
  if ('partNumber' in comp && (comp as any).partNumber) {
    return (comp as any).partNumber;
  }
  // Fallback to componentType
  return comp.componentType;
}
```

**Then replace line 621**:
```typescript
schematic += `    (property "Value" "${getComponentValueForSchematic(comp)}" (id 1) ...`;
```

### Priority 2: **Polarity in Schematic** (High Impact, Medium Complexity)

**File**: `src/utils/schematic.ts` (around lines 598-627)

**Fix**: 
1. Check `pinPolarities` when placing components
2. For polarized components, ensure pin connections respect polarity
3. Optionally use different symbol variants for polarized components

**Implementation**:
```typescript
// After line 612, before placing symbol:
const hasPolarity = comp.pinPolarities && comp.pinPolarities.some(p => p === '+' || p === '-');
if (hasPolarity) {
  // For electrolytic capacitors, use a polarized symbol
  if (comp.componentType === 'Electrolytic Capacitor') {
    symbolLibId = 'simple:ElectrolyticCapacitor'; // Would need to define this symbol
  }
  // Verify pin connections match polarity
  // Pin with '+' should connect to positive net, '-' to negative net
}
```

**Note**: May need to define polarized symbol variants in the symbol library section.

### Priority 3: **Geometric Relationships** (Medium Impact, Higher Complexity)

**File**: `src/utils/schematic.ts` (around lines 278-318)

**Current**: Components placed in grid
**Fix**: Use PCB coordinates scaled to schematic space

**Implementation**:
```typescript
// Instead of grid layout, use scaled PCB coordinates
const SCALE_FACTOR = 0.1; // mm to schematic units (adjust as needed)
const OFFSET_X = 50; // Offset to avoid negative coordinates
const OFFSET_Y = 50;

for (const comp of componentsWithDesignators) {
  let designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
  if (designator && designator.length > 0) {
    // Use scaled PCB coordinates
    const schematicX = comp.x * SCALE_FACTOR + OFFSET_X;
    const schematicY = comp.y * SCALE_FACTOR + OFFSET_Y;
    componentMap.set(designator, { comp, designator, x: schematicX, y: schematicY });
  }
}
```

### Priority 4: **Pin Number Accuracy** (Medium Impact, Medium Complexity)

**File**: `src/utils/schematic.ts` (around lines 502-596)

**Current**: `calculateComponentRotation` attempts to determine orientation
**Fix**: Ensure pin #1 is correctly identified and mapped

**Implementation**:
- Use `orientation` property directly (already stored)
- For ICs, ensure pin #1 position matches physical component
- May need to adjust pin numbering based on rotation

### Priority 5: **Additional Properties** (Low Priority, Easy)

**File**: `src/utils/schematic.ts`

**Fix**: Add optional properties to schematic symbols:
- Voltage rating
- Power rating  
- Tolerance
- Package type

## Summary

### ✅ **Fully Implemented (80%)**
- Components with designators and types
- Connections and nets
- Basic geometric positioning
- Rotation/orientation

### ⚠️ **Partially Implemented (15%)**
- Polarity data exists but not used
- Component values exist but not used
- Pin positions calculated but may need refinement

### ❌ **Missing (5%)**
- Component values in schematic (easy fix)
- Polarity enforcement in schematic (medium complexity)
- PCB layout preservation (higher complexity)

## Estimated Effort

1. **Component Values**: 1-2 hours (Priority 1)
2. **Polarity**: 3-4 hours (Priority 2)
3. **Geometric Relationships**: 4-6 hours (Priority 3)
4. **Pin Accuracy**: 2-3 hours (Priority 4)
5. **Additional Properties**: 1-2 hours (Priority 5)

**Total**: ~11-17 hours of development work

## Recommendation

Start with **Priority 1 (Component Values)** - it's the easiest fix with high impact. Then tackle **Priority 2 (Polarity)** as it's critical for accurate schematics. **Priority 3 (Geometric Relationships)** can be done later as it's more of a "nice to have" feature.

