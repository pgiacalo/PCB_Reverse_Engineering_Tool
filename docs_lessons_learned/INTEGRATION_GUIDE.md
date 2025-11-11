# Toolbar Integration Guide

## Current Situation

✅ **New Toolbar component created** in `src/components/Toolbar/`  
❌ **Not yet integrated** into `App.tsx`  
❌ **Old toolbar still in use** (inline code around line 3047)

## Why You Don't See Changes

The application is still using the old toolbar code in `App.tsx`. The new Toolbar component needs to be:
1. Imported into App.tsx
2. Rendered in place of the old toolbar
3. Connected to existing state

## Quick Integration Steps

### Step 1: Add Import to App.tsx

Add this near the top of `src/App.tsx` (around line 4):

```typescript
import { Toolbar } from './components/Toolbar';
```

### Step 2: Find and Replace Old Toolbar

**Find this code** (around line 3047):

```typescript
{/* Left toolstrip (icons) */}
<div style={{ position: 'absolute', top: 6, left: 6, bottom: 6, width: 44, ... }}>
  <button onClick={() => setCurrentTool('select')} ...>
    <MousePointer size={16} />
  </button>
  {/* ... more buttons ... */}
</div>
```

**Replace with**:

```typescript
{/* New Toolbar Component */}
<div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20 }}>
  <Toolbar
    currentTool={currentTool}
    onToolChange={setCurrentTool}
    brushColor={brushColor}
    brushSize={brushSize}
    onBrushSizeChange={setBrushSize}
    onColorPickerClick={() => setShowColorPicker(true)}
    isShiftPressed={isShiftPressed}
  />
</div>
```

### Step 3: Track Shift Key State

Add this state and effect near the other useState declarations (around line 89):

```typescript
const [isShiftPressed, setIsShiftPressed] = useState(false);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') setIsShiftPressed(true);
  };
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') setIsShiftPressed(false);
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);
```

### Step 4: Update Tool Type

The old App.tsx has its own Tool type definition. You need to either:

**Option A**: Remove the local Tool type and import from types:
```typescript
// Remove this line (around line 80):
// type Tool = 'none' | 'select' | 'draw' | 'erase' | 'transform' | 'magnify' | 'pan' | 'component' | 'ground';

// Add this import at the top:
import type { Tool } from './types';
```

**Option B**: Update the local Tool type to include 'power':
```typescript
type Tool = 'none' | 'select' | 'draw' | 'erase' | 'transform' | 'magnify' | 'pan' | 'component' | 'power' | 'ground';
```

## Expected Result

After integration, you should see:
- ✅ New vertical toolbar on the left
- ✅ All 9 tools with icons
- ✅ Integrated brush size slider
- ✅ Quick size presets (S/M/L/XL)
- ✅ Color picker button
- ✅ Better visual design

## Notes

- The new Toolbar is **240px wide** (vs old 44px), so canvas area will shift right
- Old toolbar was using Lucide icons; new uses Unicode symbols (can be upgraded to SVG later)
- Power tool (P) is new - you'll need to add handler logic for it
- Brush size control is now integrated (no separate Tools menu needed!)

## Troubleshooting

**If you see TypeScript errors:**
- Make sure Tool type includes 'power'
- Check that all imports are correct

**If toolbar doesn't appear:**
- Check browser console for errors
- Verify CSS file is being loaded
- Check z-index positioning

**If styling looks wrong:**
- Make sure `Toolbar.css` is imported in `Toolbar.tsx`
- Check for CSS conflicts with existing styles

## Full Integration (Advanced)

For a complete integration, you would also need to:
1. Handle Power tool clicks (show VoltageDialog)
2. Update keyboard shortcuts to match new tools
3. Remove old toolbar CSS
4. Adjust canvas positioning for wider toolbar

Would you like me to create a complete integration patch?

