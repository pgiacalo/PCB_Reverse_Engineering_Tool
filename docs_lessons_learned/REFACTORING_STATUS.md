# Refactoring Status: App.tsx Split into Smaller Units

## ✅ Completed

### 1. Custom Hooks Created (`src/hooks/`)
All 13 hooks have been created and are ready to use:
- `useDrawing.ts` - Drawing state and operations
- `useSelection.ts` - Selection state management
- `useTransform.ts` - Image transform state
- `useImage.ts` - PCB image state and view settings
- `useView.ts` - View state (zoom, pan, constraints)
- `useComponents.ts` - Component state management
- `usePowerGround.ts` - Power and ground symbols
- `useLayerSettings.ts` - Layer-specific settings
- `useToolRegistry.ts` - Tool registry and tool state
- `useLocks.ts` - Lock states for PCB elements
- `useDialogs.ts` - Dialog visibility states
- `useFileOperations.ts` - File operations state
- `index.ts` - Centralized exports

### 2. UI Components Created (`src/components/`)
- **MenuBar** (`MenuBar/`) - ✅ **COMPLETE** - Extracted menu bar component with File, Images, Tools, and About menus, integrated into App.tsx
- **WelcomeDialog** (`WelcomeDialog/`) - ✅ **COMPLETE** - Extracted welcome dialog component with Apache License 2.0 (2025), integrated into App.tsx
- **ErrorDialog** (`ErrorDialog/`) - ✅ **COMPLETE** - Extracted error dialog component with Apache License 2.0 (2025), integrated into App.tsx
- **DetailedInfoDialog** (`DetailedInfoDialog/`) - ✅ **COMPLETE** - Extracted detailed information dialog component (~450 lines) with Apache License 2.0 (2025), integrated into App.tsx
- **Status**: 4 components complete, other components pending

### 3. Handler Modules Created (`src/handlers/`)
- `fileHandlers.ts` - ✅ **COMPLETE** - File operation handlers extracted with Apache License 2.0 (handlePrint, saveProject, exportSimpleSchematic, newProject, openSaveAsDialog, handleOpenProject)
- `mouseHandlers.ts` - ✅ **STRUCTURE CREATED** - Mouse handler structure with Apache License 2.0, factory function pattern ready (handlers need to be extracted from App.tsx)
- `keyboardHandlers.ts` - ✅ **LICENSE ADDED** - Apache License 2.0 added, placeholder structure ready
- `index.ts` - ✅ **COMPLETE** - Centralized exports with Apache License 2.0
- **Status**: File handlers complete, mouse/keyboard handler structures ready for implementation

## ⏳ Next Steps

### Phase 1: Integrate MenuBar Component
1. Import MenuBar into App.tsx
2. Replace the inline menu bar JSX (lines ~7272-7858) with `<MenuBar ... />`
3. Pass all required props from App.tsx state
4. Test that menus work correctly

### Phase 2: Move Handlers to Handler Modules
1. ✅ **COMPLETE** - Move `handlePrint`, `saveProject`, `exportSimpleSchematic`, etc. to `fileHandlers.ts`
2. ⏳ **IN PROGRESS** - Move `handleCanvasMouseDown`, `handleCanvasMouseMove`, `handleCanvasMouseUp` to `mouseHandlers.ts`
3. ⏳ **PENDING** - Move `handleKeyDown`, `handleKeyUp` to `keyboardHandlers.ts`
4. ⏳ **PENDING** - Update App.tsx to import and use handlers from modules (file handlers ready, mouse/keyboard pending)

### Phase 3: Refactor App.tsx to Use Hooks
1. Replace state declarations with hook calls:
   ```typescript
   // Before:
   const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
   const [isDrawing, setIsDrawing] = useState(false);
   
   // After:
   const drawing = useDrawing();
   const { drawingStrokes, isDrawing, ... } = drawing;
   ```
2. Update all references to use hook values
3. Test functionality after each hook integration

### Phase 4: Extract More Components
1. ✅ **COMPLETE** - WelcomeDialog component (extracted with Apache License 2.0, 2025)
2. ✅ **COMPLETE** - ErrorDialog component (extracted with Apache License 2.0, 2025)
3. ✅ **COMPLETE** - DetailedInfoDialog component (extracted with Apache License 2.0, 2025)
4. ⏳ **PENDING** - LayersPanel component
5. ⏳ **PENDING** - Canvas component (this will be large)
6. ⏳ **PENDING** - ColorPicker component
7. ⏳ **PENDING** - ComponentEditor component
8. ⏳ **PENDING** - AboutDialog component

## Current File Structure

```
src/
├── hooks/              ✅ Complete
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
│   ├── MenuBar/        ✅ Complete, integrated
│   ├── WelcomeDialog/  ✅ Complete, integrated (Apache License 2.0, 2025)
│   ├── ErrorDialog/    ✅ Complete, integrated (Apache License 2.0, 2025)
│   ├── DetailedInfoDialog/ ✅ Complete, integrated (Apache License 2.0, 2025)
│   ├── LayersPanel/    ⏳ To be created
│   ├── Canvas/         ⏳ To be created
│   └── ...
├── handlers/           ⏳ Structure created
│   ├── fileHandlers.ts
│   ├── mouseHandlers.ts
│   ├── keyboardHandlers.ts
│   └── index.ts
└── App.tsx             ⏳ To be refactored (currently 10,992 lines)
```

## Integration Example

Here's how App.tsx should look after refactoring:

```typescript
import { useDrawing, useSelection, useImage, ... } from './hooks';
import { MenuBar } from './components/MenuBar';
import { createFileHandlers, createMouseHandlers, ... } from './handlers';

function App() {
  // Use hooks instead of useState
  const drawing = useDrawing();
  const selection = useSelection();
  const image = useImage();
  // ... other hooks
  
  // Create handlers
  const fileHandlers = createFileHandlers();
  const mouseHandlers = createMouseHandlers();
  
  return (
    <div className="app">
      <MenuBar
        openMenu={dialogs.openMenu}
        setOpenMenu={dialogs.setOpenMenu}
        // ... other props
      />
      {/* Rest of UI */}
    </div>
  );
}
```

## Notes

- All hooks are tested and have no linter errors
- MenuBar component is ready but needs integration
- Handler modules are placeholders - actual handlers need to be moved
- The refactoring should be done incrementally to maintain functionality
- Test after each major change

