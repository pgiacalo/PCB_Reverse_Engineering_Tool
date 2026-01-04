# ComponentType Mapping Analysis

## The Problem

There's a mismatch between:
- **`componentDefinitions.json` `type` field**: Generic category identifier (e.g., `"Semiconductor"`, `"Capacitor"`, `"Resistor"`)
- **Code `componentType`**: Specific component type (e.g., `"Transistor"`, `"IntegratedCircuit"`, `"Electrolytic Capacitor"`)

## Current Mapping Logic

### 1. ComponentSelectionDialog (buildMetadataForDefinition)
**Location**: `src/components/ComponentSelectionDialog/ComponentSelectionDialog.tsx:96-104`

Maps JSON structure to specific ComponentType:
```typescript
case 'Semiconductors':
  if (subcategory === 'BJT' || subcategory === 'BJT NPN' || ...) {
    componentType = 'Transistor';  // ✅ Correct mapping
  } else if (subcategory === 'Single Op Amp' || ...) {
    componentType = 'IntegratedCircuit';  // ✅ Correct mapping
  }
```

**This is CORRECT** - it properly maps the JSON structure to the specific ComponentType.

### 2. createComponentInstance (WRONG)
**Location**: `src/dataDrivenComponents/runtime/instanceFactory.ts:47`

```typescript
componentType: (definition.type as any),  // ❌ Uses "Semiconductor" directly
```

**Problem**: Uses `definition.type` which is `"Semiconductor"` for all semiconductors, ignoring the correct mapping from metadata.

### 3. App.tsx (CORRECTION)
**Location**: `src/App.tsx:3363-3374`

```typescript
// CRITICAL: Fix componentType if it was set incorrectly by the data-driven system
const metadata = selectedComponentMetadataRef.current;
if (metadata?.componentType && comp.componentType !== metadata.componentType) {
  (comp as any).componentType = metadata.componentType;  // ✅ Fixes it
}
```

**This is a WORKAROUND** - it fixes the wrong componentType set by `createComponentInstance`.

### 4. updateComponent (MORE CORRECTIONS)
**Location**: `src/components/ComponentEditor/ComponentEditor.tsx:1627-1635, 1792-1795`

```typescript
// Line 1629-1630: Convert "Semiconductor" to "IntegratedCircuit" (for non-transistors)
if ((comp as any).componentType === 'Semiconductor' && !isTransistor) {
  updated.componentType = 'IntegratedCircuit';
}

// Line 1632-1635: Convert "Semiconductor" to "Transistor" (for transistors)
else if (isTransistor && compType === 'Semiconductor') {
  updated.componentType = 'Transistor';
}

// Line 1793-1794: Another conversion
if ((comp as any).componentType === 'Semiconductor') {
  updated.componentType = 'IntegratedCircuit';
}
```

**Problem**: Multiple places trying to "fix" the componentType, creating inconsistency.

## The Root Cause

The issue is that `createComponentInstance` uses `definition.type` directly instead of using the correctly mapped `componentType` from the metadata.

## Solution

**Option 1: Fix createComponentInstance to use metadata componentType**
- Pass `componentType` from metadata to `createComponentInstance`
- Remove all the "correction" code

**Option 2: Change componentDefinitions.json**
- Change `type: "Semiconductor"` to `type: "Transistor"` for transistors
- Change `type: "Semiconductor"` to `type: "IntegratedCircuit"` for ICs
- But this breaks the generic category structure

**Option 3: Add componentType to DataDrivenComponentDefinition**
- Store the mapped componentType in the definition itself
- Use that instead of `definition.type`

## Recommendation

**Option 1 is best**: The mapping logic in `ComponentSelectionDialog` is correct and should be the source of truth. We should:
1. Pass `componentType` from metadata to `createComponentInstance`
2. Remove all the "correction" code in `updateComponent` and `App.tsx`
3. Ensure `componentType` is NEVER changed after creation
