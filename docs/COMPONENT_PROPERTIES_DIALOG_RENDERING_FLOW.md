# Component Properties Dialog Rendering Flow

## Overview

This document explains how the Component Properties (CP) dialog structure is selected and rendered, and why it might fail on subsequent opens.

## Rendering Flow

### 1. **Dialog Opening** (`openComponentEditor` in `useComponents.ts`)

When a component is double-clicked:

```typescript
openComponentEditor(component, layer)
  ↓
1. Creates editor state object
2. Resolves component definition:
   a. Checks component.componentDefinitionKey
   b. Looks up definition in COMPONENT_LIST using key
   c. If not found, falls back to resolveComponentDefinition()
3. Sets editor.componentDefinition = resolvedDef
4. Sets editor.componentDefinitionKey = key
5. Populates all dynamic fields from component data
6. Calls setComponentEditor(editor)
```

**Key Point**: The definition is resolved and stored in `componentEditor.componentDefinition`.

### 2. **Definition Prop Resolution** (`App.tsx` line 15267)

`App.tsx` computes the `componentDefinition` prop passed to `ComponentEditor`:

```typescript
componentDefinition = 
  componentEditor.componentDefinition ||  // First: Use from editor state
  resolveComponentDefinition(comp)        // Fallback: Resolve from component
```

**Key Point**: It prefers the definition from editor state, which was set in step 1.

### 3. **Field Rendering** (`ComponentTypeFields.tsx` line 60)

`ComponentTypeFields` resolves the definition in this order:

```typescript
def = 
  componentDefinition ||                    // 1. From prop (App.tsx)
  componentEditor.componentDefinition ||    // 2. From editor state
  resolveComponentDefinition(comp)         // 3. Fallback resolution
```

**Key Point**: Multiple fallback mechanisms ensure definition is found.

### 4. **Field Display** (`ComponentTypeFields.tsx` line 230)

If definition is found:
- Renders all fields from `def.fields` array
- Each field is rendered based on its type (number, string, etc.)

If definition is NOT found:
- Shows error message: "Component definition missing..."

## The Problem

### Issue: Key Mismatch After Subcategory Change

**What happened:**
1. User changed subcategory from `"BJT"` to `"BJT NPN"` in `componentDefinitions.json`
2. Old components have key: `"Semiconductors:BJT:Semiconductor"`
3. New definition has key: `"Semiconductors:BJT NPN:Semiconductor"`
4. Key lookup fails because old key doesn't exist in new definitions

**Why it works the first time:**
- `resolveComponentDefinition()` uses heuristics (designator, componentType, etc.)
- It successfully finds the definition even without matching key
- Definition is set in editor state

**Why it fails the second time:**
- Component still has old key: `"Semiconductors:BJT:Semiconductor"`
- Key lookup fails (definition with that key doesn't exist)
- `resolveComponentDefinition()` might also fail if heuristics don't match
- No definition found → error message shown

## Solution

The fix needs to:

1. **Update ComponentSelectionDialog** to handle "BJT NPN" subcategory
2. **Ensure key is updated** when definition is resolved with new subcategory
3. **Preserve key** when saving component after AI extraction
4. **Migrate old keys** to new format when loading existing components

## Code Paths

### First Open (Works)
```
openComponentEditor()
  → componentDefinitionKey = "Semiconductors:BJT:Semiconductor" (old)
  → Key lookup fails
  → resolveComponentDefinition() succeeds (heuristics)
  → Sets editor.componentDefinition
  → Renders correctly
```

### Second Open (Fails)
```
openComponentEditor()
  → componentDefinitionKey = "Semiconductors:BJT:Semiconductor" (old)
  → Key lookup fails (definition doesn't exist)
  → resolveComponentDefinition() might fail
  → No definition found
  → Error message shown
```

### After AI Extraction (Fails)
```
AI extraction updates component
  → componentDefinitionKey might be lost or not updated
  → On reopen, same issue as "Second Open"
```
