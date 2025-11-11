# PCB Reverse Engineering Tool - Refactoring Guide

## Overview

This document describes the ongoing refactoring effort to separate the monolithic `App.tsx` file into smaller, more maintainable modules organized by responsibility.

## Completed Work

### 1. Type Definitions (`src/types/index.ts`)

**Purpose**: Centralized type definitions for all data structures used in the application.

**Contents**:
- `PCBImage` - Image data with transformations
- `DrawingPoint`, `DrawingStroke` - Drawing primitives
- `Via`, `TraceSegment`, `PCBComponent`, `GroundSymbol`, `PowerNode` - PCB elements
- `ViewMode`, `Tool`, `TransformMode` - UI state types
- `LayerVisibility`, `SelectionState` - Layer and selection management
- `ProjectData` - Save/load data structure
- `Point`, `Rect`, `Bounds` - Geometric primitives

**Benefits**:
- Single source of truth for all types
- Easy to import and reuse across modules
- Better IDE autocomplete and type checking

### 2. Constants (`src/constants/index.ts`)

**Purpose**: Application-wide constants for configuration and styling.

**Contents**:
- Canvas and drawing constants (border, brush sizes, snap distance)
- Zoom and view constants (min/max zoom, zoom step)
- Transform constants (nudge, scale, rotation steps)
- Color palette (32 high-contrast colors)
- Default colors for different elements
- Selection colors and styling
- Layer z-order for rendering
- Keyboard shortcuts
- Component and symbol dimensions

**Benefits**:
- Easy to adjust configuration in one place
- No magic numbers scattered throughout code
- Consistent behavior across the application

### 3. Coordinate Utilities (`src/utils/coordinates.ts`)

**Purpose**: Coordinate system transformations and geometric calculations.

**Functions**:
- `screenToCanvas()` - Convert mouse coordinates to canvas space
- `canvasToWorld()` - Convert canvas coordinates to world space
- `worldToCanvas()` - Convert world coordinates back to canvas
- `screenToWorld()` - Direct conversion from screen to world
- `distance()` - Calculate distance between two points
- `findNearestVia()` - Find the closest via to a point
- `snapToNearestVia()` - Snap a point to the nearest via
- `pointInRect()`, `rectsOverlap()` - Rectangle intersection tests
- `distanceToSegment()` - Distance from point to line segment
- `constrainLine()` - Constrain line to horizontal/vertical
- `generatePointId()`, `generateUniqueId()` - ID generation

**Benefits**:
- Consistent coordinate transformations across the app
- Reusable geometric calculations
- Easier to debug coordinate-related issues

### 4. Cursor Utilities (`src/utils/cursors.ts`)

**Purpose**: Generate custom cursors for different tools.

**Functions**:
- `generateSelectCursor()` - Crosshair for selection
- `generateDrawCursor()` - Circle showing brush size/color
- `generateEraserCursor()` - Pink eraser icon
- `generateMagnifyCursor()` - Magnifying glass with +/-
- `generateHandCursor()` - Grab/grabbing hand
- `generateComponentCursor()` - Chip icon
- `generateGroundCursor()` - Ground symbol
- `getCursorForTool()` - Get cursor for current tool/state

**Benefits**:
- Centralized cursor generation logic
- Consistent cursor behavior
- Easy to modify cursor appearance

### 5. Canvas Drawing Utilities (`src/utils/canvas.ts`)

**Purpose**: Canvas drawing functions for all PCB elements.

**Functions**:
- `drawVia()` - Draw via with bullseye pattern
- `drawTrace()` - Draw trace polyline
- `drawComponent()` - Draw component chip icon
- `drawGroundSymbol()` - Draw ground symbol
- `drawSelectionRect()` - Draw selection rectangle
- `drawTransformedImage()` - Draw image with transforms
- `applyGrayscale()`, `applyEdgeDetection()` - Image filters
- `clearCanvas()` - Clear canvas
- `setupHiDPICanvas()` - Configure high-DPI canvas

**Benefits**:
- Consistent rendering across the application
- Selection highlighting handled in one place
- Easy to modify rendering behavior
- Reusable drawing primitives

### 6. File Operations (`src/utils/fileOperations.ts`)

**Purpose**: Save and load project files.

**Functions**:
- `formatTimestamp()` - Format date/time for filenames
- `imageToDataUrl()` - Convert image to data URL
- `prepareProjectData()` - Prepare data for saving
- `saveProject()` - Save using File System Access API
- `loadProject()` - Load using File System Access API
- `restoreImage()` - Restore ImageBitmap from data URL
- `exportProjectAsJSON()`, `importProjectFromJSON()` - JSON conversion
- `loadImageFile()` - Load image from file
- `fallbackSaveProject()`, `fallbackLoadProject()` - Fallback for older browsers

**Benefits**:
- Centralized file I/O logic
- Consistent save/load behavior
- Fallback support for older browsers
- Easy to modify file format

### 7. Selection Utilities (`src/utils/selection.ts`)

**Purpose**: Hit-testing and selection logic for all PCB elements.

**Functions**:
- `isPointInVia()`, `isViaInRect()` - Via selection
- `isPointOnTrace()`, `isTraceInRect()` - Trace selection
- `isPointInComponent()`, `isComponentInRect()` - Component selection
- `isPointInGround()`, `isGroundInRect()` - Ground symbol selection
- `selectViasInRect()`, `selectTracesInRect()`, etc. - Batch selection

**Benefits**:
- Consistent selection behavior
- Reusable hit-testing logic
- Easy to add new element types
- Centralized selection algorithms

## Remaining Work

### Next Steps

The following components still need to be created to complete the refactoring:

1. **UI Components** (React components):
   - `src/components/Toolbar.tsx` - Left toolbar with tool buttons
   - `src/components/MenuBar.tsx` - Top menu bar (File, View, Transform, Tools)
   - `src/components/LayersPanel.tsx` - Layers panel with visibility toggles
   - `src/components/Canvas.tsx` - Main canvas component with drawing logic
   - `src/components/ColorPicker.tsx` - Color palette picker
   - `src/components/ComponentEditor.tsx` - Component properties dialog

2. **Custom Hooks** (React hooks):
   - `src/hooks/useDrawing.ts` - Drawing state and logic
   - `src/hooks/useSelection.ts` - Selection state and logic
   - `src/hooks/useTransform.ts` - Image transform state and logic
   - `src/hooks/useKeyboard.ts` - Keyboard event handling

3. **Refactor App.tsx**:
   - Remove utility functions (now in utils/)
   - Extract UI components (now in components/)
   - Use custom hooks for state management
   - Keep only top-level state and composition

## Migration Strategy

### Phase 1: Create Utility Modules ✅ COMPLETED
- Extract pure functions and utilities
- No React dependencies
- Easy to test in isolation

### Phase 2: Create UI Components (IN PROGRESS)
- Extract React components from App.tsx
- Use utility modules
- Keep components focused on presentation

### Phase 3: Create Custom Hooks (PENDING)
- Extract stateful logic from App.tsx
- Use utility modules
- Reusable across components

### Phase 4: Refactor App.tsx (PENDING)
- Compose UI from components
- Use custom hooks for state
- Minimal logic in App.tsx

## Benefits of Refactoring

1. **Maintainability**: Smaller files are easier to understand and modify
2. **Reusability**: Utilities and components can be reused
3. **Testability**: Pure functions are easy to unit test
4. **Collaboration**: Multiple developers can work on different modules
5. **Performance**: Easier to optimize specific modules
6. **Debugging**: Easier to isolate and fix bugs
7. **Documentation**: Each module has a clear purpose

## File Organization

```
src/
├── types/
│   └── index.ts              # All TypeScript type definitions
├── constants/
│   └── index.ts              # Application constants
├── utils/
│   ├── canvas.ts             # Canvas drawing utilities
│   ├── coordinates.ts        # Coordinate transformations
│   ├── cursors.ts            # Custom cursor generation
│   ├── fileOperations.ts     # Save/load project files
│   ├── geometry.ts           # Geometric calculations (existing)
│   └── selection.ts          # Selection hit-testing
├── hooks/                    # Custom React hooks (to be created)
│   ├── useDrawing.ts
│   ├── useSelection.ts
│   ├── useTransform.ts
│   └── useKeyboard.ts
├── components/               # React components (to be created)
│   ├── Toolbar.tsx
│   ├── MenuBar.tsx
│   ├── LayersPanel.tsx
│   ├── Canvas.tsx
│   ├── ColorPicker.tsx
│   └── ComponentEditor.tsx
├── workers/
│   ├── cvWorker.ts           # Computer vision worker (existing)
│   └── skeletonize.ts        # Skeletonization (existing)
├── App.tsx                   # Main application (to be refactored)
├── App.css                   # Application styles
└── main.tsx                  # Entry point
```

## Testing Strategy

As we create new modules, we should add tests:

1. **Unit Tests**: Test utility functions in isolation
2. **Component Tests**: Test React components with React Testing Library
3. **Integration Tests**: Test interactions between components
4. **E2E Tests**: Test complete user workflows

## Next Actions

1. Create `src/components/` directory
2. Extract Toolbar component from App.tsx
3. Extract MenuBar component from App.tsx
4. Extract LayersPanel component from App.tsx
5. Extract Canvas component from App.tsx
6. Create custom hooks for state management
7. Refactor App.tsx to use new components and hooks
8. Add tests for new modules
9. Update documentation

## Notes

- All utility modules are pure functions with no React dependencies
- Components should be as "dumb" as possible (presentation only)
- State management should be in custom hooks or App.tsx
- Keep backwards compatibility during refactoring
- Test each module as it's created
- Update REQUIREMENTS.md and README.md as needed

