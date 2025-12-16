## Component Cursor Flicker / Size Jumping (Component Tool)

### Summary

When using the **Component** tool, the cursor icon (chip outline with abbreviation) would occasionally **flash or jump between small and large sizes** while hovering over the canvas.  
The underlying cause was **inconsistent sizing models** between the on‑canvas component icons and the component cursor, combined with view‑scale‑dependent rounding.

### Symptoms

- While the Component tool was active and the mouse hovered over the canvas:
  - The component cursor sometimes **snapped between two different sizes** as the user zoomed or panned.
  - The flicker was intermittent, making it hard to reproduce consistently.
- Actual components drawn on the canvas were stable; the issue affected **only the cursor icon**, not the rendered components.

### Technical Context

- **On‑canvas components**:
  - Drawn in `App.tsx` inside `drawCanvas`:
    - Size derived from the component instance: `const size = Math.max(10, c.size || 18);`
    - Zoom is applied by the **view transform** (`viewScale`) before drawing.
    - Line width is adjusted for zoom: `lineWidth = Math.max(1, 2 / Math.max(viewScale, 0.001))`.
  - Netlist and selection helpers (`selection.ts`, `netlist.ts`) use the same base geometry:
    - `size = component.size || COMPONENT_ICON.DEFAULT_SIZE;`
    - `chipWidth = size * 0.8`, `chipHeight = size * 0.6`, etc.
  - Net effect: the **single source of truth for component size is `component.size`**, with `COMPONENT_ICON.DEFAULT_SIZE` as the default.

- **Component cursor (pre‑fix)**:
  - Implemented in a large `React.useEffect` in `App.tsx` that builds a custom cursor using a `<canvas>`.
  - For `kind === 'component'`, the radius/diameter was computed as:
    - `diameterPx = Math.max(16, Math.round(brushSize * viewScale));`
  - The cursor body was a square whose side length was `diameterPx`.
  - The cursor depended on:
    - `brushSize`, `viewScale`, and various tool / layer states.
  - Importantly, it **did not use the component tool instance size** (the value that ultimately becomes `component.size` when placing a component).

### Root Cause

1. **Different size inputs**:
   - On‑canvas components: size came from `component.size` (or `COMPONENT_ICON.DEFAULT_SIZE`), independent of `viewScale` (viewScale applied only via transform).
   - Component cursor: size came from `brushSize * viewScale`, with an additional `Math.round` and `Math.max(16, …)` clamp.

2. **View‑scale‑dependent rounding and clamping**:
   - As `viewScale` changed (due to zoom or perspective/transform updates), `brushSize * viewScale` occasionally fluctuated around integer thresholds.
   - Combined with `Math.round` and a hard minimum, this produced cases where small, real‑time changes in `viewScale` caused `diameterPx` to jump by 1–2 pixels.
   - Because the cursor is regenerated whenever its dependencies change, these small jumps manifested as **visible flicker between two cursor sizes**.

3. **Multiple “units” in play (world vs screen)**:
   - Component icons on canvas are defined in **world coordinates** and then scaled by the view.
   - The cursor icon was being sized directly in **screen pixels** from `brushSize * viewScale`, creating a subtly different scaling curve from the on‑canvas icons.
   - This mismatch made the cursor behave differently from the components it represents.

### Investigation Notes

- Verified where component geometry is defined:
  - `drawCanvas` in `App.tsx` and helpers in `utils/canvas.ts`, `utils/selection.ts`, `utils/netlist.ts`.
  - All of these use `component.size` (with `COMPONENT_ICON.DEFAULT_SIZE` fallback).
- Found that the component cursor in the `useEffect` in `App.tsx`:
  - Used `brushSize * viewScale` for `diameterPx`.
  - Ignored the component tool instance’s `size`.
- Confirmed that the cursor effect runs often (on zoom, pan, tool changes, layer changes) and that any small change in `viewScale` feeds back into `diameterPx`.

### Fix Implemented

We made the **component cursor use the same size model as on‑canvas components**, based on the component tool instance size instead of `brushSize`.

Key changes (in `App.tsx`):

- **Import the component icon constants**:

```ts
import {
  formatComponentTypeName,
  COLOR_PALETTE,
  COMPONENT_ICON,
} from './constants';
```

- **Update the cursor sizing logic for `kind === 'component'`** inside the cursor `useEffect`:

```ts
const scale = viewScale;

let diameterPx: number;
if (kind === 'magnify') {
  diameterPx = 18;
} else if (kind === 'component') {
  // Use component tool instance size (single source of truth), not generic brushSize.
  const layer = componentToolLayer || 'top';
  const componentInstanceId = layer === 'top' ? 'componentTop' : 'componentBottom';
  const componentInstance = toolInstanceManager.get(componentInstanceId);
  const worldSize = componentInstance.size || COMPONENT_ICON.DEFAULT_SIZE;
  diameterPx = Math.max(16, Math.round(worldSize * scale));
} else if (kind === 'power' || kind === 'ground') {
  diameterPx = Math.max(12, Math.round(brushSize * scale));
} else {
  diameterPx = Math.max(6, Math.round(brushSize * scale));
}
```

- The rest of the cursor drawing code (using `diameterPx` as the component square’s side) remains the same.

### Why This Fix Works

- **Single source of truth for component size**:
  - Cursor now uses the same size input as real components: the component tool instance’s `size`, with `COMPONENT_ICON.DEFAULT_SIZE` as fallback.
  - This matches how `createComponent` and the drawing/selection helpers interpret component sizes.

- **Consistent use of view scale**:
  - Both the cursor and the on‑canvas icons are now scaled by `viewScale` in a comparable way:
    - Components: world size → view transform → pixels.
    - Cursor: world size → `worldSize * viewScale` → pixels.
  - This alignment removes the mismatch that previously caused occasional jumps.

- **Reduced jitter from rounding**:
  - While we still round `worldSize * viewScale`, the **worldSize** is stable and comes from the tool instance, so minor variations in `viewScale` are much less likely to produce visually disruptive jumps.
  - The minimum size clamp (`Math.max(16, …)`) is preserved for usability, but it now sits on top of a stable world‑size model.

### Verification

- Reproduced the original scenario:
  - Activated the Component tool, hovered over the canvas, and performed zoom in/out and pan operations.
  - Previously observed intermittent cursor size jumps; after the fix, the cursor size changed smoothly and predictably with zoom, without flicker.
- Confirmed:
  - On‑canvas component icon sizes remain unchanged.
  - No new TypeScript or ESLint errors were introduced (`read_lints` on `App.tsx` is clean).

### Lessons Learned / Best Practices

- **Unify geometry and scaling**:
  - Always derive cursor/preview geometry from the **same size and coordinate system** used by the actual rendered objects.
  - Avoid mixing `brushSize`, `component.size`, and ad‑hoc `viewScale` multipliers unless there is a clear and justified reason.

- **Use a single source of truth for tool sizes**:
  - Tool instances (managed via `toolInstanceManager`) are the correct place to store current tool size and color.
  - Both canvas rendering and cursors should consume these values rather than duplicating logic from UI state.

- **Be careful with world vs screen units**:
  - World coordinates (pcb units) should be transformed consistently via view transforms (`viewScale`, rotation, flips).
  - Cursor and overlay elements in screen space should be derived from world units in a controlled, predictable manner.

- **Minimize unnecessary cursor recomputation**:
  - Cursor recomputes are cheap but visually sensitive; keep their dependencies limited to state that truly affects cursor appearance.
  - Avoid indirect or noisy dependencies that can cause frequent, tiny changes (e.g., multiple derived states that all reflect the same underlying size).

- **Document subtle UX regressions**:
  - Visual glitches like cursor flicker can be easy to re‑introduce when refactoring cursor or transform logic.
  - Capturing the root cause and the fix in a lesson‑learned document (this file) helps prevent regressions and speeds up future debugging.


