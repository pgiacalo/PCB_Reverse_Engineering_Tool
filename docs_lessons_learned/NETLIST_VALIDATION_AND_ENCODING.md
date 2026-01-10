# Netlist Validation and Encoding Fixes

## Date: 2026-01-10

## Issues Discovered by AI Analysis

### 1. Missing Component Values

**Problem**: Components (R1-R7, C1-C2, B1) were exported to the netlist without their resistance, capacitance, or capacity values.

**Root Cause**: The `getComponentValueString()` function in `hybridNetlist.ts` only exports a value if the component has a non-empty value field. If users don't fill in these fields in the Component Properties dialog, the components are exported without values.

**Solution Implemented**:
- Added tracking of components that should have values but don't
- Added console warning when components are missing values
- Added user confirmation dialog before exporting netlist with missing values
- The dialog lists all components missing values and asks if the user wants to proceed

**Code Changes**:
- `src/utils/hybridNetlist.ts`: Added `missingValueComponents` array to track components without values
- `src/utils/hybridNetlist.ts`: Modified component value export logic to track missing values
- `src/App.tsx`: Added check for `lastWarnings` after netlist generation and show confirmation dialog

**User Impact**: Users are now warned when exporting netlists with incomplete component data, allowing them to go back and fill in missing values before export.

### 2. Tolerance UTF-8 Encoding Issue

**Problem**: The tolerance field was being exported with corrupted UTF-8 encoding: `"tolerance": "Â±5%"` instead of `"tolerance": "±5%"`.

**Root Cause**: The `±` character (Unicode U+00B1, UTF-8: 0xC2 0xB1) was being double-encoded or misinterpreted somewhere in the data pipeline. This typically happens when:
- A UTF-8 string is read as ISO-8859-1 and then re-encoded as UTF-8
- The two-byte UTF-8 sequence (0xC2 0xB1) is interpreted as two separate Latin-1 characters (Â and ±)

**Solution Implemented**:
- Added normalization of tolerance strings in the netlist export
- Replace any double-encoded `Â±` sequences with the correct `±` character
- This fix is defensive and handles the issue at export time regardless of where the corruption occurred

**Code Changes**:
- `src/utils/hybridNetlist.ts`: Added `replace(/Â±/g, '±')` to normalize tolerance strings before export

**Technical Details**:
```typescript
// Fix any double-encoded UTF-8 issues (Â± → ±)
const normalizedTolerance = tolerance.replace(/Â±/g, '±');
hybridComp.tolerance = normalizedTolerance;
```

**User Impact**: Tolerance values are now correctly encoded in exported netlists, ensuring proper parsing by external tools and AI analysis.

## Component Value Requirements

### Components That Should Have Values

The following component types should have their primary value fields filled in:

1. **Resistors** (`Resistor`, `Thermistor`, `VariableResistor`):
   - **Required**: `resistance` + `resistanceUnit` (e.g., "10kΩ")
   - Optional: `power` (e.g., "1/4W")
   - Optional: `tolerance` (e.g., "±5%")

2. **Capacitors** (`Capacitor`, `Electrolytic Capacitor`, `Film Capacitor`):
   - **Required**: `capacitance` + `capacitanceUnit` (e.g., "100µF")
   - Optional: `voltage` + `voltageUnit` (e.g., "25V")
   - Optional: `tolerance` (e.g., "±10%")

3. **Inductors** (`Inductor`):
   - **Required**: `inductance` + `inductanceUnit` (e.g., "10µH")

4. **Batteries** (`Battery`):
   - **Required**: `voltage` + `voltageUnit` (e.g., "3.7V")
   - **Required**: `capacity` + `capacityUnit` (e.g., "2000mAh")

### Validation Logic

The validation is implemented in `getMissingRequiredFields()` function in `hybridNetlist.ts`:

```typescript
function getMissingRequiredFields(comp: PCBComponent): string[] {
  const missing: string[] = [];
  
  switch (comp.componentType) {
    case 'Resistor':
      if (!comp.resistance || String(comp.resistance).trim() === '') {
        missing.push('resistance');
      }
      break;
      
    case 'Capacitor':
    case 'Electrolytic Capacitor':
    case 'Film Capacitor':
      if (!comp.capacitance || String(comp.capacitance).trim() === '') {
        missing.push('capacitance');
      }
      break;
      
    case 'Inductor':
      if (!comp.inductance || String(comp.inductance).trim() === '') {
        missing.push('inductance');
      }
      break;
      
    case 'Battery':
      if (!comp.voltage || String(comp.voltage).trim() === '') {
        missing.push('voltage');
      }
      if (!comp.capacity || String(comp.capacity).trim() === '') {
        missing.push('capacity');
      }
      break;
  }
  
  return missing;
}
```

**Key Points**:
- Only checks for **primary value fields** that define the component's electrical characteristics
- Empty strings, null, or undefined values are considered missing
- Whitespace-only values are considered missing
- Other component types (ICs, connectors, etc.) are not validated as they don't have simple "value" fields

### Best Practices

### Enhanced User Interface (v3.5.1+)

**Interactive Missing Values Dialog**:

When exporting a netlist with components missing required values, an enhanced dialog appears with:

1. **Component List**: Each component is shown with:
   - Designator (e.g., "R1")
   - Component type (e.g., "Resistor")
   - Layer (Top/Bottom)
   - Specific missing fields (e.g., "resistance")

2. **Fix Button**: Each component has a "Fix →" button that:
   - Closes the validation dialog
   - Highlights the component on the canvas
   - Centers the canvas view on the component
   - Opens the Component Properties dialog
   - (Future) Sets focus to the missing field

3. **Action Buttons**:
   - **Cancel Export**: Closes dialog without exporting
   - **Proceed Anyway**: Continues with export despite missing values

**User Workflow**:
```
1. User clicks File → Export Netlist (JSON)
2. System validates all components
3. If missing values found:
   a. Dialog shows list of components with issues
   b. User clicks "Fix →" on a component
   c. Component is highlighted and properties dialog opens
   d. User fills in missing values
   e. User clicks File → Export Netlist again
4. If no missing values (or user proceeds anyway):
   a. AI net name analysis runs
   b. Netlist is exported
```

1. **Fill in component values as you place components**: Use the Component Properties dialog to enter values immediately after placing components.

2. **Use AI datasheet extraction**: For complex components, use the AI feature to extract values from datasheets automatically.

3. **Review validation dialog**: When the missing values dialog appears, use the "Fix" buttons to quickly navigate to and update each component.

4. **Consistent tolerance values**: Use the dropdown menus in the Component Properties dialog to ensure consistent tolerance encoding.

## Testing

To verify the fixes:

1. **Create test components**: Place resistors and capacitors with various tolerance values
2. **Export netlist**: Use File → Export Netlist (JSON)
3. **Check exported file**: Open the netlist JSON and verify:
   - Tolerance values use `±` not `Â±`
   - Components with values have them in the netlist
   - Warning dialog appears if components are missing values

## Related Files

- `src/utils/hybridNetlist.ts` - Netlist generation and validation
- `src/App.tsx` - Export flow and user warnings
- `src/hooks/useComponents.ts` - Component property defaults
- `src/components/ComponentEditor/ComponentTypeFields.tsx` - Component property UI

## Future Improvements

1. **Auto-populate default values**: Consider adding sensible default values for common component types (e.g., 10kΩ for resistors, 100nF for capacitors)

2. **Value validation**: Add validation to ensure values are in reasonable ranges (e.g., warn if a resistor is 0Ω or 1TΩ)

3. **Batch value entry**: Add a feature to set values for multiple similar components at once

4. **Value inference from designators**: Some PCBs encode values in designators (e.g., "R10K" for 10kΩ) - could parse these automatically
