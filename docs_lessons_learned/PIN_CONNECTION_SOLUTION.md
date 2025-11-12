# Pin Connection Feature - Solution Documentation

## Problem

When implementing the component pin-to-via connection feature, clicks on vias were not being registered when the component properties dialog was open. The dialog overlay was blocking mouse events from reaching the canvas, preventing users from connecting pins to vias.

## Root Cause

The component properties dialog is positioned as `position: fixed` with a high `z-index` (1000), which places it above the canvas. When users clicked on vias visible through or near the dialog, the click events were being intercepted by the dialog element instead of reaching the canvas's `onMouseDown` handler.

## Solution

Implemented a **document-level mousedown handler** that uses the **capture phase** to intercept clicks before they reach the dialog. This handler:

1. **Only activates when in pin connection mode** (`connectingPin` state is set)
2. **Converts screen coordinates to canvas coordinates** to find the correct via
3. **Ignores clicks on dialog UI elements** (buttons, inputs) to allow normal dialog interaction
4. **Processes clicks on the canvas** even when the dialog is open

## Key Technical Details

### Event Capture Phase

```typescript
document.addEventListener('mousedown', handlePinConnectionClick, true);
```

The third parameter `true` enables the capture phase, which means the handler runs **before** the event reaches the dialog element. This allows us to process the click before it's blocked.

### Coordinate Conversion

The handler converts browser screen coordinates to canvas world coordinates:

```typescript
// Get canvas bounding rect
const rect = canvas.getBoundingClientRect();

// Convert screen coords to CSS coords
const cssX = clickX - rect.left;
const cssY = clickY - rect.top;

// Convert CSS coords to canvas pixel coords (accounting for device pixel ratio)
const canvasX = cssX * dprX;
const canvasY = cssY * dprY;

// Convert to content world coords (subtract border, apply pan/scale)
const contentCanvasX = canvasX - CONTENT_BORDER;
const contentCanvasY = canvasY - CONTENT_BORDER;
const x = (contentCanvasX - viewPan.x) / viewScale;
const y = (contentCanvasY - viewPan.y) / viewScale;
```

### Dialog Identification

The dialog is marked with a `data-component-editor-dialog` attribute to allow the handler to identify and exclude dialog UI elements:

```typescript
const dialogElement = document.querySelector('[data-component-editor-dialog]');
if (dialogElement && e.target instanceof Node && dialogElement.contains(e.target)) {
  // Check if it's a button or input - allow those to work normally
  const target = e.target as HTMLElement;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || 
      target.closest('button') || target.closest('input')) {
    return; // Let the dialog handle its own buttons/inputs
  }
  // If clicking on dialog background, allow it to pass through
}
```

### State Updates

The handler uses functional state updates to ensure it works with the latest component state:

```typescript
setComponentsTop(prev => {
  const comp = prev.find(c => c.id === componentId);
  if (!comp) return prev;
  
  // ... update pinConnections array ...
  
  return prev.map(c => c.id === componentId ? { ...c, pinConnections: newPinConnections } : c);
});
```

## Benefits

1. **Non-intrusive**: Dialog buttons and inputs continue to work normally
2. **Reliable**: Works regardless of dialog position or canvas zoom/pan state
3. **User-friendly**: Users can connect pins without closing the dialog
4. **Maintainable**: Clean separation between dialog UI and connection logic

## Alternative Approaches Considered

1. **Making dialog transparent to pointer events**: Would break dialog interaction
2. **Moving dialog out of the way**: Poor UX, dialog would jump around
3. **Canvas click handler only**: Doesn't work when dialog blocks clicks
4. **Portal with lower z-index**: Complex and doesn't solve the fundamental issue

## Lessons Learned

1. **Event capture phase is powerful** for handling events before they reach child elements
2. **Document-level handlers** can work around z-index and overlay issues
3. **Coordinate conversion** must account for device pixel ratio, pan, scale, and borders
4. **Functional state updates** prevent stale closure issues in event handlers
5. **Data attributes** provide a clean way to identify DOM elements for event handling

## Related Files

- `src/App.tsx`: Document-level handler (lines ~2504-2640), dialog markup (lines ~3802-3830)
- Component pin connection logic in `handleCanvasMouseDown` (lines ~471-633) still works for clicks directly on canvas

