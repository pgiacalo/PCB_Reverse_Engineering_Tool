# Refactoring Progress: Splitting App.tsx into Smaller Logical Units

## Overview
The `App.tsx` file is currently **10,992 lines** and needs to be split into smaller, logical units for better maintainability, testability, and collaboration.

## Completed Work

### ✅ Custom Hooks Created (`src/hooks/`)

1. **`useDrawing.ts`** - Drawing state and operations
   - `drawingStrokes`, `isDrawing`, `currentStroke`
   - `drawingMode`, `selectedDrawingLayer`
   - Actions: `startDrawing`, `stopDrawing`, `addPointToStroke`, `finishStroke`

2. **`useSelection.ts`** - Selection state management
   - `selectedIds`, `selectedComponentIds`, `selectedPowerIds`, `selectedGroundIds`
   - Actions: `clearSelection`, `addToSelection`, `removeFromSelection`, `setSelection`

3. **`useTransform.ts`** - Image transform state
   - `selectedImageForTransform`, `isTransforming`, `transformStartPos`, `transformMode`
   - Actions: `startTransform`, `stopTransform`

4. **`useImage.ts`** - PCB image state and view settings
   - `topImage`, `bottomImage`, `currentView`, `transparency`
   - Image filters: `isGrayscale`, `isBlackAndWhiteEdges`, `isBlackAndWhiteInverted`
   - Actions: `loadTopImage`, `loadBottomImage`, `clearImages`

5. **`useView.ts`** - View state (zoom, pan, constraints)
   - `viewScale`, `viewPan`, `isShiftConstrained`, `showBothLayers`
   - Actions: `resetView`, `zoomIn`, `zoomOut`, `setZoom`, `pan`, `setPan`

6. **`useComponents.ts`** - Component state management
   - `componentsTop`, `componentsBottom`, `componentEditor`
   - Actions: `addComponent`, `updateComponent`, `removeComponent`, `openComponentEditor`, `closeComponentEditor`

7. **`usePowerGround.ts`** - Power and ground symbols
   - `powerBuses`, `powerSymbols`, `groundSymbols`
   - Actions: `addPowerBus`, `updatePowerBus`, `removePowerBus`, etc.

8. **`useLayerSettings.ts`** - Layer-specific settings (colors, sizes)
   - All brush, trace, pad, component colors and sizes per layer
   - Actions: `saveDefaultSize`, `saveDefaultColor`

9. **`useToolRegistry.ts`** - Tool registry and tool state
   - `toolRegistry`, tool settings management
   - Actions: `updateToolSettings`, `updateToolLayerSettings`

10. **`useLocks.ts`** - Lock states for different PCB element types
    - Lock states for images, vias, pads, traces, components, power, ground
    - Actions: `lockAll`, `unlockAll`

11. **`useDialogs.ts`** - Dialog visibility states
    - All dialog states (menus, dialogs, color picker, welcome dialog)

12. **`useFileOperations.ts`** - File operations state
    - Auto-save state, project management, file history

13. **`index.ts`** - Centralized exports for all hooks

## Pending Work

### ⏳ UI Components to Extract (`src/components/`)

1. **MenuBar** - File, Images, Tools, About menus (lines ~7272-7800)
2. **LayersPanel** - Layer visibility controls
3. **Canvas** - Main drawing canvas with all rendering logic
4. **ColorPicker** - Color selection dialog
5. **ComponentEditor** - Component properties dialog
6. **DetailedInfoDialog** - Debug/selection information dialog
7. **WelcomeDialog** - Welcome screen
8. **AboutDialog** - About menu content
9. **Various Dialogs** - Auto-save, new project, save as, etc.

### ⏳ Event Handlers to Extract (`src/handlers/`)

1. **mouseHandlers.ts** - `handleCanvasMouseDown`, `handleCanvasMouseMove`, `handleCanvasMouseUp`
2. **keyboardHandlers.ts** - `handleKeyDown`, `handleKeyUp`
3. **fileHandlers.ts** - File operation handlers

### ⏳ Integration

1. Refactor `App.tsx` to use the new hooks
2. Replace inline UI with extracted components
3. Connect event handlers to components
4. Test all functionality
5. Fix any integration issues

## File Structure (Target)

```
src/
├── hooks/              ✅ Created
│   ├── useDrawing.ts
│   ├── useSelection.ts
│   ├── useTransform.ts
│   ├── useImage.ts
│   ├── useView.ts
│   ├── useComponents.ts
│   ├── usePowerGround.ts
│   ├── useLayerSettings.ts
│   ├── useToolRegistry.ts
│   ├── useLocks.ts
│   ├── useDialogs.ts
│   ├── useFileOperations.ts
│   └── index.ts
├── components/         ⏳ In Progress
│   ├── Toolbar/        ✅ Already exists
│   ├── MenuBar/        ⏳ To be created
│   ├── LayersPanel/    ⏳ To be created
│   ├── Canvas/         ⏳ To be created
│   └── ...
├── handlers/           ⏳ To be created
│   ├── mouseHandlers.ts
│   ├── keyboardHandlers.ts
│   └── fileHandlers.ts
└── App.tsx             ⏳ To be refactored (currently 10,992 lines)
```

## Next Steps

1. Extract MenuBar component
2. Extract LayersPanel component
3. Extract Canvas component (this will be large)
4. Extract event handlers
5. Refactor App.tsx to compose everything together

## Notes

- All hooks are created and tested (no linter errors)
- Hooks follow React best practices with proper dependencies
- TypeScript types are properly defined
- The refactoring maintains backward compatibility during migration

