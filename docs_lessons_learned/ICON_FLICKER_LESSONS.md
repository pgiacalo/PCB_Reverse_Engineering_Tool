## Tool Icon & Cursor Flicker / Size & Color Inconsistencies

### Overview

Over time we hit several **icon/cursor flicker problems** across tools (Component, Trace, and later Via/Pad/Test Point).  
All of them traced back to the same family of issues:

- Multiple, competing **sources of truth** for tool size and color.
- Mixing **world units** (PCB space) with **screen pixels** in different ways.
- Cursor `useEffect` logic that was **too sensitive** to unrelated state changes.

This document consolidates the underlying causes, the concrete fixes we implemented, and the **best practices** we’re now following so these problems don’t come back.

---

### 1. Component Tool Cursor Flicker (Size Jumping)

#### Symptoms

- With the **Component** tool active and the mouse over the canvas:
  - The component cursor (chip outline with abbreviation) would **flash between two sizes** as you zoomed or sometimes simply hovered.
  - The behavior was **intermittent** – not every zoom or movement triggered it.
- Components already placed on the canvas were stable; only the **cursor icon** misbehaved.

#### Technical Context (Pre‑fix)

- **On‑canvas components**:
  - Size derived from the component instance: effectively `component.size || COMPONENT_ICON.DEFAULT_SIZE`.
  - Drawn in world units; `viewScale` is applied by the canvas transform.
  - Selection / netlist helpers use the same base geometry.
  - Net effect: **single source of truth = `component.size` (world units)**.

- **Component cursor** (before the fix):
  - Implemented in a `React.useEffect` in `App.tsx` that builds a custom cursor `<canvas>`.
  - For `kind === 'component'`, the diameter was computed as something like:
    - `diameterPx = Math.max(16, Math.round(brushSize * viewScale));`
  - Depended on `brushSize`, `viewScale`, and several tool/layer states.
  - Did **not** use the component tool instance’s `size`.

#### Root Cause

1. **Different size inputs**:
   - On‑canvas components: `component.size` (world units).
   - Cursor: `brushSize * viewScale` (screen pixels).

2. **Jitter from view‑scale rounding and clamping**:
   - Small changes in `viewScale` (from zoom, pan, or transform updates) made `brushSize * viewScale` hover around integer thresholds.
   - Combined with `Math.round` and a hard minimum, the cursor size would jump between adjacent pixel sizes.
   - Because the cursor is redrawn on every dependency change, these jumps manifested as a **visible flicker**.

3. **Mixed coordinate systems (world vs screen)**:
   - Components: world units → view transform → pixels.
   - Cursor: `brushSize` * `viewScale` directly in pixels, not derived from the same world‑size value.
   - This inconsistency meant the cursor and canvas icons did not track each other perfectly.

4. **Over‑broad cursor dependencies** (regression):
   - At one point, the cursor `useEffect` depended directly on `toolState.size` / `toolState.color`.
   - `toolState` is a large object that changes for many reasons, so the cursor was being recomputed **far more often** than necessary.
   - That higher recomputation frequency made the underlying rounding/clamping issue much more visible.

#### Fix

- **Unify the size model**:
  - For `kind === 'component'`, the cursor now:
    - Looks up the **component tool instance** via `toolInstanceManager` (`componentTop` / `componentBottom`).
    - Uses `worldSize = instance.size || COMPONENT_ICON.DEFAULT_SIZE`.
    - Computes `diameterPx = Math.max(16, Math.round(worldSize * viewScale));`.

- **Simplify dependencies**:
  - The cursor effect no longer depends on the full `toolState` object.
  - It uses stable, **primitive inputs** (tool instance size, `viewScale`, etc.) to avoid unnecessary recomputes.

#### Why It Works

- Cursor and on‑canvas components now share the **same world‑space size** and differ only by the view transform.
- Rounding still exists, but because the underlying `worldSize` is stable, small viewScale changes no longer produce distracting jumps.
- Reducing dependencies keeps the cursor from being redrawn for unrelated state changes, eliminating visual “buzz.”

---

### 2. Trace Tool Cursor & Preview Flicker (Size and Color)

#### Symptoms

- With the **Trace** tool active:
  - The trace cursor occasionally **flickered in size** similar to the component cursor problem.
  - More importantly, the **color** of the preview segment and/or cursor would sometimes:
    - Start in the **previous tool’s color**, then snap to the correct trace color on the first click.
    - Flicker between colors when switching tools or layers.
  - Toggling trace layers (Top/Bottom) sometimes “fixed” the issue temporarily.

#### Technical Context (Pre‑fix)

We effectively had **several overlapping models** for trace size and color:

- **Tool instances** (via `toolInstanceManager`):
  - `traceTop` / `traceBottom` instances, each with `size` and `color`.
  - Intended to be the **authoritative source** for how traces are drawn.

- **Per‑layer React state**:
  - `topTraceColor`, `bottomTraceColor`, `topTraceSize`, `bottomTraceSize`.
  - Stored in project state and persisted into project files.

- **Brush state**:
  - `brushColor`, `brushSize`.
  - Originally introduced as a convenient way to connect UI controls (color picker, size slider) to whatever tool is active.

- **Tool registry**:
  - Map of tool definitions, including `settings` and `layerSettings` used for persistence and re‑initialization.

The cursor and preview effects were reading from **different combinations** of these, and `brushColor`/`brushSize` could temporarily hold values from the **previous tool** during a tool switch.

#### Root Causes

1. **Multiple sources of truth for size and color**:
   - Trace color and size were being:
     - Written from UI into `brushColor`/`brushSize`.
     - Copied into per‑layer state.
     - Copied into tool instances and the tool registry.
   - On a tool switch, `brushColor` still reflected the **previous tool** until the trace tool caught up, leading to transient but visible mismatches.

2. **Cursor effect too tightly coupled to brush state**:
   - The cursor `useEffect` keyed off `brushColor`/`brushSize` in a generic way.
   - This meant that **transitional brush values** (still set to the prior tool) could leak into the trace cursor and preview before the trace tool’s own state fully synchronized.

3. **Trace cursor size model similar to the old component model**:
   - For `kind === 'trace'`, cursor size was essentially a `brushSize * viewScale` style calculation.
   - This produced the same rounding‑induced size flicker as the component cursor.

4. **Overly broad persistence effect**:
   - A “tool settings persistence” effect updated the tool registry and per‑layer defaults whenever `brushColor`/`brushSize` changed.
   - For trace/pad/test point/component tools, this meant persistence sometimes ran based on **stale or cross‑tool brush values**, reinforcing the confusion between tools.

#### Fix – Size

- We aligned the **trace cursor size model** with the component fix:
  - For `kind === 'trace'`, the cursor now:
    - Chooses `traceTop` or `traceBottom` instance based on the active layer.
    - Uses `worldSize = traceInstance.size || 6` (world units).
    - Computes `diameterPx = Math.max(6, Math.round(worldSize * viewScale));`.
  - The same pattern was then applied to **via**, **pad**, and **test point** tools:
    - Each cursor uses its tool instance’s `size` (world units) scaled by `viewScale`.

Result: all drawing tools now share a **consistent size model**: “world size from the tool instance × viewScale”.

#### Fix – Color and Persistence (Single Source of Truth per Tool)

We refactored the “update tool‑specific settings when color/size changes” effect so that, for tools with layer support, it no longer trusts `brushColor`/`brushSize` as authoritative.

Concretely, in `App.tsx`:

- **Before (conceptually)**:
  - For trace / pad / test point / component:
    - Read `layer = traceToolLayer || 'top'` (or equivalent).
    - Use **`brushColor`** and **`brushSize`** to:
      - Update `topTraceColor` / `bottomTraceColor` etc.
      - Call `saveDefaultColor` / `saveDefaultSize`.
      - Update the tool registry’s `settings` and `layerSettings`.
      - Update `prevBrushColorRef` / `prevBrushSizeRef`.

- **After (current behavior)**:
  - For each of these tools we now:
    - Derive the **tool instance ID** from the active layer (e.g., `traceTop` / `traceBottom`).
    - Read **`const color = instance.color; const size = instance.size;`**.
    - Use `color` and `size` as the **only source of truth** for:
      - Updating per‑layer React state (`topTraceColor`, `bottomTraceColor`, etc.).
      - Saving defaults (`saveDefaultColor`, `saveDefaultSize`).
      - Updating tool registry `settings` and `layerSettings`.
      - Updating `prevBrushColorRef` and `prevBrushSizeRef`.

In other words:

- The **tool instance** owns the canonical color and size.
- `brushColor`/`brushSize` are treated as **view/UI helpers**, not authoritative state.
- Persistence and registry updates are always derived from whatever the instance says, eliminating the window where the previous tool’s brush color could leak into trace settings.

#### Why It Works

- When you switch to the trace tool, the cursor, preview, and final trace lines all use the **trace instance’s color/size** immediately.
- Even if `brushColor` still briefly holds the previous tool’s color, it no longer drives persistence or cursor appearance for trace.
- Layer toggling (Top/Bottom) simply switches between trace instances that each maintain their own authoritative color/size; there’s no cross‑contamination.

---

### 3. General Lessons & Best Practices

#### 3.1 Single Source of Truth Per Tool

- For each drawing tool (trace, via, pad, test point, component, power, ground):
  - The **tool instance**, managed by `toolInstanceManager`, is the **only authoritative source** for:
    - `size` (world units).
    - `color` (logical drawing color).
  - All of the following should be **derived from the instance**, not the other way around:
    - Custom cursors.
    - On‑canvas rendering.
    - Per‑layer state (`topTraceColor`, etc.).
    - Tool registry `settings` / `layerSettings`.
    - Saved defaults and persisted project configuration.

#### 3.2 World vs Screen Coordinates

- Keep geometry in **world space** as long as possible:
  - Store `size` in world units on tool instances and components.
  - Apply `viewScale` and transforms as a **render‑time concern**.
- For cursors and overlays:
  - Compute screen pixels as `worldSize * viewScale` (plus any minimal clamping).
  - Avoid independent, ad‑hoc pixel‑space formulas that don’t match the world‑space model.

#### 3.3 Narrow `useEffect` Dependencies

- Cursor and preview effects are visually sensitive:
  - They should depend only on **state that truly affects the cursor’s appearance** (tool instance ID, worldSize, color, `viewScale`, etc.).
  - Avoid putting whole objects like `toolState` or large state trees in dependencies; those tend to change on every render.
- If an effect seems to run “too often” and produce small visual jitter:
  - Look for **derived or redundant dependencies**.
  - Replace them with the minimal set of stable primitives.

#### 3.4 Avoid Cross‑Tool Contamination

- UI state like `brushColor` and `brushSize` are convenient, but they should be:
  - Treated as **views onto** the current tool instance, not as authoritative configuration.
  - Updated **from** the instance when switching tools, not used to overwrite instance state blindly.
- When switching tools:
  - Initialize the new tool’s instance state from its own persisted defaults, not from whatever was left in the generic brush state for the previous tool.

#### 3.5 Document Subtle UX Regressions

- Visual glitches such as **flicker, size jumps, or color flashes** can:
  - Be intermittent.
  - Re‑appear after unrelated refactors.
- Capturing:
  - The **symptoms**,
  - The **root cause** (world vs screen, multiple sources of truth, etc.),
  - And the **fix pattern** (unify size/color source, narrow effects)
  - in a document like this makes it much easier to spot and prevent regressions in the future.

---

### Summary

- All of the icon/cursor flicker issues we’ve seen come back to **inconsistent size/color sources** and **mixed coordinate systems**, amplified by over‑broad `useEffect` dependencies.
- Our current architecture:
  - Uses **tool instances** as the single source of truth for each tool’s size and color.
  - Derives cursor and rendering sizes as `worldSize * viewScale`.
  - Limits cursor/persistence effects to the **minimal set of necessary inputs**.
- With this pattern in place, the Component, Trace, Via, Pad, and Test Point tools all now have **stable, predictable cursor and icon behavior**.


