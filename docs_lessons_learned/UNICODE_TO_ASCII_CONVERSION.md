# Unicode to ASCII Conversion

**Date:** January 10, 2026  
**Status:** Complete

## Problem

The application was using Unicode symbols (`±`, `Ω`, `µ`) throughout the codebase. While these symbols display correctly in modern editors and browsers, they can cause compatibility issues with downstream tools that expect ASCII-only characters or use different character encodings.

### Specific Issues Identified
1. **Tolerance Values**: `±5%` was being misinterpreted by some tools as `Â±5%` (mojibake)
2. **Resistance Units**: `Ω` (omega) could cause parsing issues
3. **Micro Prefix**: `µ` (mu) in units like `µF`, `µH`, `µA` could be misread

## Solution

### Two-Tier Approach
We implemented a dual-layer system that:
1. **Stores ASCII internally** - All data persistence, JSON exports, and internal processing use ASCII
2. **Displays Unicode in GUI** - User-facing dropdowns and labels show Unicode for better UX

### ASCII Mappings
- `±` → `+/-` (tolerance values)
- `Ω` → `ohm` (resistance units)
- `µF` → `uF` (microfarads)
- `µH` → `uH` (microhenries)  
- `µA` → `uA` (microamps)
- `µ` → `u` (any other micro prefix)

### Implementation Details

#### 1. New Utility Functions (`src/constants/index.ts`)
```typescript
export function formatUnitForDisplay(unit: string): string {
  const displayMap: Record<string, string> = {
    'ohm': 'Ω',
    'mohm': 'mΩ',
    'kohm': 'kΩ',
    'Mohm': 'MΩ',
    'uF': 'µF',
    'uH': 'µH',
    'uA': 'µA',
  };
  return displayMap[unit] || unit;
}

export function formatUnitForStorage(unit: string): string {
  const storageMap: Record<string, string> = {
    'Ω': 'ohm',
    'mΩ': 'mohm',
    'kΩ': 'kohm',
    'MΩ': 'Mohm',
    'µF': 'uF',
    'µH': 'uH',
    'µA': 'uA',
  };
  return storageMap[unit] || unit;
}
```

#### 2. Component Properties Dialog (`src/components/ComponentEditor/ComponentTypeFields.tsx`)
- Updated all dynamic unit dropdowns to use `formatUnitForDisplay(unit)`
- Example:
  ```tsx
  <option key={unit} value={unit}>{formatUnitForDisplay(unit)}</option>
  ```
- The `value` attribute stores ASCII (e.g., `"uF"`)
- The display text shows Unicode (e.g., `"µF"`)

#### 3. Updated Constants (`src/constants/index.ts`)
- Changed all unit definitions from Unicode to ASCII
- Example: `['ohm', 'kohm', 'Mohm']` instead of `['Ω', 'kΩ', 'MΩ']`

#### 4. Updated Default Values (`src/hooks/useComponents.ts`)
- All default tolerance values changed from `±` to `+/-`
- All default unit values changed to ASCII equivalents

#### 5. Updated Type Definitions (`src/types/index.ts`)
- Comments and type annotations updated to use ASCII

#### 6. Updated Utility Functions
- `src/utils/schematic.ts` - Regex patterns updated to match ASCII units
- `src/utils/netlist.ts` - Regex patterns updated to match ASCII units
- `src/utils/nodeProperties.ts` - Comments updated to ASCII
- `src/utils/transformations.ts` - Comments updated to ASCII

#### 7. Updated AI Prompts (`src/data/aiPrompts.json`)
- Example text in prompts updated to use ASCII (e.g., `+/-0.1V` instead of `±0.1V`)

#### 8. Removed Corruption Fix Code
Deleted all `.replace(/Â±/g, '±')` normalization code from:
- `src/components/ComponentEditor/ComponentEditor.tsx`
- `src/App.tsx` (both top and bottom component loading)
- `src/utils/hybridNetlist.ts`

These were unnecessary as the characters were never actually corrupted - they were valid UTF-8 that some downstream tools couldn't handle.

## Benefits

### 1. **Maximum Compatibility**
- JSON netlist files are now pure ASCII
- No encoding ambiguity with downstream tools
- Works with legacy parsers and strict ASCII-only tools

### 2. **Better User Experience**
- GUI still shows familiar Unicode symbols (Ω, µ, ±)
- Users see professional, standard notation
- No confusion about what units mean

### 3. **Future-Proof**
- Easy to add more Unicode → ASCII mappings if needed
- Clear separation between storage and display layers
- Consistent approach across the entire application

### 4. **Data Integrity**
- No risk of encoding corruption during save/load cycles
- Reliable round-tripping through various tools
- Predictable behavior across different platforms

## Files Modified

### Core Logic
- `src/constants/index.ts` - Added conversion functions, updated unit definitions
- `src/hooks/useComponents.ts` - Updated default values
- `src/types/index.ts` - Updated type comments

### UI Components
- `src/components/ComponentEditor/ComponentTypeFields.tsx` - Updated dropdowns to display Unicode
- `src/components/ComponentEditor/ComponentEditor.tsx` - Removed corruption fix code

### Utilities
- `src/utils/schematic.ts` - Updated regex patterns
- `src/utils/netlist.ts` - Updated regex patterns
- `src/utils/nodeProperties.ts` - Updated comments
- `src/utils/transformations.ts` - Updated comments
- `src/utils/hybridNetlist.ts` - Removed corruption fix code

### Data
- `src/data/aiPrompts.json` - Updated example text
- `src/App.tsx` - Removed corruption fix code

## Testing

Build verified successful with no TypeScript errors or warnings (other than chunk size).

## Related Documents
- `NETLIST_QUALITY_FIXES_SUMMARY.md` - Overall netlist quality improvements
- `docs/REQUIREMENTS.md` - Updated requirements for data quality
- `docs_lessons_learned/NETLIST_VALIDATION_AND_ENCODING.md` - Technical analysis

## Conclusion

The application now maintains a clean separation between internal ASCII storage and Unicode display. This ensures maximum compatibility with downstream tools while preserving an excellent user experience in the GUI.
