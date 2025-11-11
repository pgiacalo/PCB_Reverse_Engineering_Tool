# Toolbar Component Specification

## Overview

The Toolbar is a vertical panel on the left side of the application containing all drawing tools, color picker, and brush size controls.

## Visual Layout

```
┌─────────────────────────────────────┐
│           TOOLBAR                   │
├─────────────────────────────────────┤
│                                     │
│  ┌───┐  Select Tool            (S) │
│  │ ⊕ │  Click to select objects    │
│  └───┘                              │
│                                     │
│  ┌───┐  Draw Vias              (V) │
│  │ ◎ │  Place via connection       │
│  └───┘                              │
│                                     │
│  ┌───┐  Draw Traces            (T) │
│  │ ╱ │  Draw copper traces         │
│  └───┘                              │
│                                     │
│  ┌───┐  Draw Component         (C) │
│  │ ▭ │  Place component            │
│  └───┘                              │
│                                     │
│  ┌───┐  Draw Power             (P) │ ← NEW!
│  │ ⊕ │  Place power node           │
│  └───┘                              │
│                                     │
│  ┌───┐  Draw Ground            (G) │
│  │ ⏚ │  Place ground symbol        │
│  └───┘                              │
│                                     │
│  ┌───┐  Erase                  (E) │
│  │ ▭ │  Erase objects              │
│  └───┘                              │
│                                     │
│  ┌───┐  Move                   (H) │
│  │ ✋ │  Pan the view               │
│  └───┘                              │
│                                     │
│  ┌───┐  Zoom In/Out            (Z) │
│  │ 🔍 │  Magnify view               │
│  └───┘                              │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ┌───┐  Color Picker                │
│  │ ■ │  Current: #FF0000            │
│  └───┘                              │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Brush Size:                        │
│  ┌─────────────────────┐            │
│  │████████░░░░░░░░░░░░░│ 12px       │
│  └─────────────────────┘            │
│                                     │
│  Quick Sizes:                       │
│  [S] [M] [L] [XL]                   │
│   2   6  12  24                     │
│                                     │
└─────────────────────────────────────┘
```

## Components Breakdown

### 1. Tool Buttons (9 tools)

Each tool button includes:
- **Icon**: Visual representation of the tool
- **Label**: Tool name
- **Shortcut**: Keyboard shortcut in parentheses
- **Tooltip**: Expanded description on hover
- **Active State**: Highlighted when selected
- **Color Reflection**: Via, Trace, Component, Power, Ground icons show current brush color

#### Tool List:

| Tool | Icon | Shortcut | Description |
|------|------|----------|-------------|
| Select | ⊕ | S | Select objects or groups |
| Via | ◎ | V | Place via (bullseye pattern) |
| Trace | ╱ | T | Draw copper traces |
| Component | ▭ | C | Place component |
| Power | ⊕ | P | Place power node (NEW!) |
| Ground | ⏚ | G | Place ground symbol |
| Erase | ▭ | E | Erase objects |
| Move | ✋ | H | Pan/move view |
| Zoom | 🔍 | Z | Zoom in/out (+ or - with Shift) |

### 2. Color Picker Button

- **Visual**: Square filled with current color
- **Label**: "Color Picker"
- **Click**: Opens color palette popup
- **Current Color Display**: Shows hex value below icon
- **Affects**: Via, Trace, Component, Power, Ground colors

### 3. Brush Size Control

#### Slider
- **Range**: 1-50 pixels
- **Current Value Display**: Shows numeric value (e.g., "12px")
- **Visual Feedback**: Slider fill shows current position
- **Live Update**: Changes apply immediately
- **Affects**: All drawing tools (Via, Trace, Erase, Ground, Power)

#### Quick Size Presets
- **S (Small)**: 2px - Fine detail work
- **M (Medium)**: 6px - Standard traces
- **L (Large)**: 12px - Thick traces, large vias
- **XL (Extra Large)**: 24px - Very large elements

### 4. Power Node Tool (NEW!)

**Purpose**: Place power nodes at specific voltage levels

**Workflow**:
1. User selects Power tool (P)
2. User clicks on drawing area
3. **Voltage dialog appears** with:
   - Common voltages: +5V, +3.3V, +12V, -5V, -12V
   - Custom voltage input field
   - OK/Cancel buttons
4. Power node placed with voltage tag
5. Icon shows voltage label

**Visual Representation**:
```
    +5V
     │
    ─┴─  (power symbol with voltage label)
```

**Properties**:
- `id`: Unique identifier
- `x, y`: Position
- `voltage`: String (e.g., "+5V", "+3.3V", "-12V")
- `color`: Display color
- `size`: Visual size

## TypeScript Interface

```typescript
import type { Tool } from '../types';

interface ToolbarProps {
  // Current tool state
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  
  // Brush settings
  brushColor: string;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  
  // Color picker
  onColorPickerClick: () => void;
  
  // Keyboard state (for dynamic tooltips)
  isShiftPressed?: boolean;
}

interface ToolButtonProps {
  tool: Tool;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  tooltip: string;
  isActive: boolean;
  onClick: () => void;
  color?: string; // For color-reflective tools
}

interface SizePreset {
  label: string;
  value: number;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: 'S', value: 2 },
  { label: 'M', value: 6 },
  { label: 'L', value: 12 },
  { label: 'XL', value: 24 },
];
```

## Styling Requirements

### Tool Buttons
- **Size**: 48x48px
- **Spacing**: 8px between buttons
- **Border**: 2px solid transparent (active: #00bfff)
- **Background**: 
  - Default: rgba(255, 255, 255, 0.1)
  - Hover: rgba(255, 255, 255, 0.2)
  - Active: rgba(0, 191, 255, 0.3)
- **Icon Size**: 32x32px
- **Font**: 12px for labels, 10px for shortcuts

### Color Picker Button
- **Size**: 48x48px
- **Border**: 2px solid #ccc
- **Fill**: Current brush color
- **Label**: Below button, 10px font

### Brush Size Slider
- **Width**: 200px
- **Height**: 8px
- **Track**: rgba(255, 255, 255, 0.2)
- **Fill**: Current brush color
- **Thumb**: 16x16px circle, white with shadow

### Quick Size Buttons
- **Size**: 40x32px
- **Spacing**: 4px
- **Font**: 12px bold
- **Border**: 1px solid rgba(255, 255, 255, 0.3)
- **Active**: Border color matches brush color

### Container
- **Width**: 240px (fixed)
- **Background**: rgba(0, 0, 0, 0.8)
- **Padding**: 16px
- **Border-right**: 1px solid rgba(255, 255, 255, 0.2)

## Behavior

### Tool Selection
1. Click tool button → Tool becomes active
2. Previous tool deselects
3. Icon updates to show active state
4. Cursor changes to tool-specific cursor
5. Keyboard shortcut also activates tool

### Color-Reflective Tools
When brush color changes, update icon fill for:
- Via tool icon
- Trace tool icon
- Component tool icon
- Power tool icon
- Ground tool icon

### Brush Size
1. Drag slider → Size updates in real-time
2. Click preset button → Size jumps to preset value
3. Size affects all drawing tools immediately
4. Cursor size updates to reflect brush size

### Tooltips
- **Show on hover** after 500ms delay
- **Position**: To the right of button
- **Content**: Tool name + description
- **Shortcut**: Shown in parentheses
- **Dynamic**: Zoom tool shows "Zoom In" or "Zoom Out" based on Shift key

## Accessibility

- **Keyboard Navigation**: Tab through tools
- **Keyboard Shortcuts**: All tools have shortcuts
- **ARIA Labels**: All buttons have descriptive labels
- **Focus Indicators**: Clear focus outline
- **Screen Reader**: Announces tool changes

## Integration with App.tsx

### State Management
```typescript
// In App.tsx
const [currentTool, setCurrentTool] = useState<Tool>('none');
const [brushColor, setBrushColor] = useState('#ff0000');
const [brushSize, setBrushSize] = useState(10);

// Pass to Toolbar
<Toolbar
  currentTool={currentTool}
  onToolChange={setCurrentTool}
  brushColor={brushColor}
  brushSize={brushSize}
  onBrushSizeChange={setBrushSize}
  onColorPickerClick={() => setShowColorPicker(true)}
  isShiftPressed={isShiftPressed}
/>
```

### Event Flow
1. User clicks tool → `onToolChange` called
2. App.tsx updates `currentTool` state
3. Canvas cursor updates
4. Tool-specific behavior activates

## Power Node Dialog (NEW!)

### VoltageDialog.tsx

```typescript
interface VoltageDialogProps {
  isOpen: boolean;
  onSelect: (voltage: string) => void;
  onCancel: () => void;
}

const COMMON_VOLTAGES = [
  '+5V',
  '+3.3V',
  '+12V',
  '+15V',
  '-5V',
  '-12V',
  '-15V',
  'GND', // For convenience
];
```

### Dialog Layout
```
┌─────────────────────────────────┐
│  Select Power Node Voltage      │
├─────────────────────────────────┤
│  Common Voltages:               │
│  ┌─────┐ ┌──────┐ ┌──────┐     │
│  │ +5V │ │+3.3V │ │ +12V │     │
│  └─────┘ └──────┘ └──────┘     │
│  ┌─────┐ ┌──────┐ ┌──────┐     │
│  │ -5V │ │ -12V │ │ +15V │     │
│  └─────┘ └──────┘ └──────┘     │
│                                 │
│  Custom Voltage:                │
│  ┌─────────────────────────┐   │
│  │ +                       │   │
│  └─────────────────────────┘   │
│                                 │
│         [OK]  [Cancel]          │
└─────────────────────────────────┘
```

## File Structure

```
src/
├── components/
│   ├── Toolbar/
│   │   ├── Toolbar.tsx          # Main toolbar component
│   │   ├── ToolButton.tsx       # Individual tool button
│   │   ├── BrushSizeSlider.tsx  # Brush size control
│   │   ├── SizePresets.tsx      # Quick size buttons
│   │   ├── VoltageDialog.tsx    # Power node voltage selector (NEW!)
│   │   └── Toolbar.css          # Toolbar styles
│   └── ...
```

## Testing Checklist

- [ ] All 9 tools selectable
- [ ] Only one tool active at a time
- [ ] Keyboard shortcuts work
- [ ] Tool icons reflect current color
- [ ] Brush size slider updates in real-time
- [ ] Size presets work correctly
- [ ] Color picker button opens palette
- [ ] Tooltips appear on hover
- [ ] Active tool highlighted
- [ ] Power tool opens voltage dialog
- [ ] Voltage dialog allows custom input
- [ ] Power nodes created with correct voltage

## Next Steps After Toolbar

1. **ColorPicker.tsx** - Popup for color selection
2. **VoltageDialog.tsx** - Voltage selection for power nodes
3. **Canvas.tsx** - Integrate new Power tool
4. **Update types** - Add PowerNode type
5. **Update constants** - Add Power tool to KEYBOARD_SHORTCUTS

