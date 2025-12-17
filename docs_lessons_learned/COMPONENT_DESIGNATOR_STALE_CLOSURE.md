## Component Designator Mismatch: Stale Closure in React Event Handlers

### Overview

We encountered a critical bug where **component designators shown in the cursor did not match the designators drawn on the canvas** when placing components. The cursor would correctly display the designator from the selected component in the dialog (e.g., "Z" for Zener diode), but the component placed on the canvas would use an incorrect designator (e.g., "D1" instead of "Z1").

This problem was caused by a **stale closure** in React's `useCallback` hook. The event handler was capturing the value of `selectedComponentMetadata` at the time the callback was created, but because `selectedComponentMetadata` was not included in the dependency array, the callback never got recreated when the selection changed.

The solution uses the **`useRef` pattern** to provide event handlers with access to the latest state values without triggering unnecessary re-renders or callback recreations.

---

### Symptoms

- **Cursor designator**: Correctly shows the designator from the component selected in the "Select Component" dialog (e.g., "Z" for Zener, "LED" for LED, "IR" for Infrared).
- **Canvas designator**: When placing a component, the designator drawn on the canvas was often incorrect:
  - All diodes would get "D" instead of their specific designators ("LED", "Z", "IR", "PD").
  - Circuit breakers would get "AT" instead of "CB".
  - Varistors would get "VR" instead of "RV".
- **Inconsistent behavior**: The problem was **intermittent** – sometimes the correct designator would appear, sometimes not, depending on when the component was selected relative to when the event handler was created.

### Technical Context

#### Component Selection Flow

1. **User selects component in dialog**:
   - `ComponentSelectionDialog` calls `onComponentTypeChange(componentType, uniqueKey, metadata)`
   - `metadata` contains `componentDefinition` (legacy) and `dataDrivenDefinition` (v2)
   - `setSelectedComponentMetadata(metadata)` updates React state

2. **User clicks canvas to place component**:
   - `handleCanvasMouseDown` event handler is invoked
   - Handler reads `selectedComponentMetadata?.dataDrivenDefinition`
   - Uses that definition to create component instance via `createComponentInstance()`
   - `assignDesignator()` uses the definition's `designator` field to assign prefix + number

#### The Problem: Stale Closure

The `handleCanvasMouseDown` handler was defined using `useCallback`:

```typescript
const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  // ... component placement code ...
  const dataDrivenDefinition = selectedComponentMetadata?.dataDrivenDefinition;
  // ...
}, [/* dependency array */]);
```

**Critical Issue**: `selectedComponentMetadata` was **NOT** in the dependency array. The dependency array only included:
- `currentTool`, `selectedImageForTransform`, `brushSize`, `brushColor`, `drawingMode`, etc.
- But **NOT** `selectedComponentMetadata`, `componentToolLayer`, `selectedComponentType`, etc.

#### What Happened

1. **Initial render**: `handleCanvasMouseDown` is created with `selectedComponentMetadata = null` (or initial value)
2. **User selects "Z - Zener"**: State updates to include Zener definition
3. **Callback NOT recreated**: Because `selectedComponentMetadata` isn't in dependencies, the callback still has the old closure
4. **User clicks canvas**: Handler executes with the **stale value** from step 1
5. **Wrong designator**: Component is created with the wrong (or missing) definition

### Root Cause

#### React Closure Behavior

When a function is defined inside a React component, it captures the values of variables from its enclosing scope at the time it's created. This is called a **closure**.

With `useCallback`, the function is only recreated when dependencies change. If a variable used inside the callback is **not** in the dependency array:
- The callback keeps the **old value** from when it was first created
- Even though the state variable has updated, the callback still sees the stale value
- This is a **stale closure bug**

#### Why Not Just Add to Dependencies?

Adding `selectedComponentMetadata` (and other missing dependencies) to the dependency array would cause:
- **Frequent callback recreation**: Every time the user selects a different component, the callback is recreated
- **Performance impact**: Recreating large callbacks frequently can cause unnecessary re-renders
- **Cascade effect**: Other dependencies like `componentsTop`, `componentsBottom` would also need to be added, causing recreation on every component placement

#### The Real Issue

The event handler needs the **latest value** at the time of execution, not the value from when the callback was created. This is a perfect use case for the `useRef` pattern.

### Fix

#### Implementation: The `useRef` Pattern

The solution uses React refs to provide event handlers with access to the latest state values:

**Step 1: Create refs to hold latest values**

```typescript
// State for UI reactivity
const [selectedComponentMetadata, setSelectedComponentMetadata] = useState<ComponentSelectionMetadata | null>(null);
const [selectedComponentType, setSelectedComponentType] = useState<ComponentType | null>(null);

// Refs for event handlers (avoids stale closure issues)
const selectedComponentMetadataRef = React.useRef<ComponentSelectionMetadata | null>(null);
const selectedComponentTypeRef = React.useRef<ComponentType | null>(null);
```

**Step 2: Sync refs with state using useEffect**

```typescript
// Sync refs for event handlers (avoids stale closure issues)
React.useEffect(() => {
  selectedComponentMetadataRef.current = selectedComponentMetadata;
}, [selectedComponentMetadata]);

React.useEffect(() => {
  selectedComponentTypeRef.current = selectedComponentType;
}, [selectedComponentType]);
```

**Step 3: Read from refs in event handlers**

```typescript
const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  // ... component placement code ...
  
  // Read from ref to avoid stale closure issues (ref always has the latest value)
  if (!selectedComponentTypeRef.current) {
    return; // Wait for user to select a component type
  }
  
  // Read from ref to avoid stale closure issues (ref always has the latest value)
  const dataDrivenDefinition = selectedComponentMetadataRef.current?.dataDrivenDefinition;
  if (!dataDrivenDefinition) {
    console.error('[Component Creation] Missing dataDrivenDefinition metadata for selected component.');
    return;
  }
  
  // ... rest of component creation ...
}, [/* dependencies without selectedComponentMetadata */]);
```

**Step 4: Also use existing refs for other state**

We also updated the code to use the existing `componentToolLayerRef` instead of the state variable:

```typescript
// Before: const layer = componentToolLayer || 'top';
// After:
const layer = componentToolLayerRef.current || 'top';
```

### Why It Works

#### How Refs Solve the Problem

1. **Refs are mutable**: `ref.current` can be updated without triggering re-renders
2. **Same object reference**: The ref object itself never changes, only its `.current` property
3. **Always current**: When the event handler reads `ref.current`, it gets the **latest value** that was set by the `useEffect`
4. **No closure capture**: The callback doesn't capture the ref's value; it reads it at execution time

#### The Flow (After Fix)

1. **Initial render**: 
   - `selectedComponentMetadataRef.current = null`
   - `handleCanvasMouseDown` callback is created (doesn't matter what ref.current is)

2. **User selects "Z - Zener"**:
   - `setSelectedComponentMetadata(metadata)` updates state
   - `useEffect` runs: `selectedComponentMetadataRef.current = metadata` (latest value)

3. **User clicks canvas**:
   - `handleCanvasMouseDown` executes
   - Reads `selectedComponentMetadataRef.current` → gets **latest value** (Zener definition)
   - Component is created with correct designator "Z1"

4. **User selects "LED - LED"**:
   - State updates, `useEffect` updates ref
   - Next click uses LED definition → "LED1"

#### Benefits

- ✅ **Always current**: Event handlers always read the latest state value
- ✅ **No unnecessary recreations**: Callback doesn't need to be recreated when state changes
- ✅ **Performance**: Avoids frequent callback recreation and potential re-renders
- ✅ **Simple pattern**: Easy to understand and maintain
- ✅ **React-recommended**: This is the official React pattern for this exact use case

### Best Practices

#### When to Use the `useRef` Pattern

Use refs for state that needs to be accessed in:
- **Event handlers** (especially those with large dependency arrays)
- **Callbacks** that shouldn't be recreated frequently
- **Intervals/timeouts** that need latest values
- **Third-party library callbacks** that don't participate in React's lifecycle

#### When NOT to Use Refs

- **UI rendering**: Always use state for values that affect what's rendered
- **Derived values**: Use `useMemo` or `useCallback` with proper dependencies
- **Values that trigger effects**: Use state so `useEffect` can react to changes

#### Pattern Checklist

When implementing the ref pattern:

1. ✅ **Keep state for UI**: State variables are still needed for React to re-render UI
2. ✅ **Create ref alongside state**: `const myRef = useRef<Type>(null)`
3. ✅ **Sync with useEffect**: Always sync refs when state changes
4. ✅ **Read from ref in handlers**: Use `ref.current` in event handlers/callbacks
5. ✅ **Use state in render**: Use state variables in JSX/render logic
6. ✅ **Document the pattern**: Add comments explaining why refs are used

#### Example Pattern

```typescript
// ✅ State for UI reactivity
const [myValue, setMyValue] = useState<Type>(initialValue);

// ✅ Ref for event handlers
const myValueRef = useRef<Type>(initialValue);

// ✅ Sync ref with state
useEffect(() => {
  myValueRef.current = myValue;
}, [myValue]);

// ✅ In event handler: read from ref
const handleClick = useCallback(() => {
  const latestValue = myValueRef.current; // Always current!
  // ... use latestValue ...
}, []); // Empty deps - callback never needs recreation

// ✅ In render: use state
return <div>{myValue}</div>; // React re-renders when state changes
```

### Related Issues

This same pattern was already being used for:
- `componentToolLayerRef` - synced with `componentToolLayer` state
- `traceToolLayerRef`, `padToolLayerRef`, `testPointToolLayerRef` - for layer-specific tool settings

The component designator issue was the first case where we needed this pattern for **component selection metadata**.

### Testing

To verify the fix works:

1. **Select "Z - Zener"** in the dialog → cursor shows "Z"
2. **Place component** → canvas shows "Z1" ✅
3. **Select "LED - LED"** in the dialog → cursor shows "LED"
4. **Place component** → canvas shows "LED1" ✅
5. **Select "IR - Infrared"** in the dialog → cursor shows "IR"
6. **Place component** → canvas shows "IR1" ✅

All designators should now match between cursor and canvas.

### Summary

- **Problem**: Stale closure in `useCallback` caused event handlers to use outdated component selection
- **Root cause**: `selectedComponentMetadata` was used in callback but not in dependency array
- **Solution**: `useRef` pattern to provide event handlers with latest state values
- **Result**: Cursor and canvas designators now always match the selected component
- **Pattern**: Use refs for state accessed in event handlers; keep state for UI rendering

This is a common React pattern for avoiding stale closures in event handlers while maintaining performance.

