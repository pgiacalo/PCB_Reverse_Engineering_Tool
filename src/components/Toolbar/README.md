# Toolbar Component

## Overview

The Toolbar component provides a vertical panel with all drawing tools, color picker, and brush size controls.

## Features

- ✅ 9 drawing tools (Select, Via, Trace, Component, Power, Ground, Erase, Move, Zoom)
- ✅ Integrated brush size slider (1-50px)
- ✅ Quick size presets (S, M, L, XL)
- ✅ Color picker button
- ✅ Color-reflective tool icons
- ✅ Keyboard shortcuts
- ✅ Tooltips with shortcuts
- ✅ Active tool highlighting
- ✅ Voltage dialog for Power tool
- ✅ Responsive design
- ✅ Accessibility support

## Usage

### Basic Example

```typescript
import { Toolbar } from './components/Toolbar';
import { useState } from 'react';

function App() {
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(10);
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="app">
      <Toolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        brushColor={brushColor}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onColorPickerClick={() => setShowColorPicker(true)}
      />
      {/* Rest of your app */}
    </div>
  );
}
```

### With Keyboard State

```typescript
import { Toolbar } from './components/Toolbar';
import { useState, useEffect } from 'react';

function App() {
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

  return (
    <Toolbar
      currentTool={currentTool}
      onToolChange={setCurrentTool}
      brushColor={brushColor}
      brushSize={brushSize}
      onBrushSizeChange={setBrushSize}
      onColorPickerClick={() => setShowColorPicker(true)}
      isShiftPressed={isShiftPressed}
    />
  );
}
```

## Props

### Toolbar Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currentTool` | `Tool` | Yes | Currently active tool |
| `onToolChange` | `(tool: Tool) => void` | Yes | Called when tool changes |
| `brushColor` | `string` | Yes | Current brush color (hex) |
| `brushSize` | `number` | Yes | Current brush size (1-50) |
| `onBrushSizeChange` | `(size: number) => void` | Yes | Called when size changes |
| `onColorPickerClick` | `() => void` | Yes | Called when color picker clicked |
| `isShiftPressed` | `boolean` | No | Whether Shift key is pressed (for Zoom tooltip) |

## Sub-Components

### ToolButton

Individual tool button with icon, label, and tooltip.

```typescript
<ToolButton
  tool="select"
  icon="⊕"
  label="Select"
  shortcut="S"
  tooltip="Select objects or groups"
  isActive={currentTool === 'select'}
  onClick={() => onToolChange('select')}
/>
```

### BrushSizeSlider

Slider control for brush size with value display.

```typescript
<BrushSizeSlider
  value={brushSize}
  onChange={setBrushSize}
  color={brushColor}
/>
```

### SizePresets

Quick size preset buttons (S, M, L, XL).

```typescript
<SizePresets
  currentSize={brushSize}
  onSizeSelect={setBrushSize}
  color={brushColor}
/>
```

### VoltageDialog

Modal dialog for selecting power node voltage.

```typescript
<VoltageDialog
  isOpen={showVoltageDialog}
  onSelect={(voltage) => {
    // Create power node with this voltage
    setShowVoltageDialog(false);
  }}
  onCancel={() => setShowVoltageDialog(false)}
/>
```

## Keyboard Shortcuts

| Key | Tool | Description |
|-----|------|-------------|
| S | Select | Select objects or groups |
| V | Via | Place via connection |
| T | Trace | Draw copper traces |
| C | Component | Place component |
| P | Power | Place power node |
| G | Ground | Place ground symbol |
| E | Erase | Erase objects |
| H | Move | Pan the view |
| Z | Zoom | Zoom in/out (+ Shift for zoom out) |

## Styling

The Toolbar uses CSS custom properties for theming. You can override these in your global styles:

```css
.toolbar {
  --toolbar-bg: rgba(0, 0, 0, 0.8);
  --toolbar-border: rgba(255, 255, 255, 0.2);
  --tool-button-bg: rgba(255, 255, 255, 0.1);
  --tool-button-hover: rgba(255, 255, 255, 0.2);
  --tool-button-active: rgba(0, 191, 255, 0.3);
  --active-border: #00bfff;
}
```

## Accessibility

- All buttons have `aria-label` attributes
- Keyboard navigation with Tab
- Focus indicators
- Tooltips for screen readers
- Semantic HTML structure

## Integration with Power Tool

The Power tool requires additional handling in your app:

```typescript
import { VoltageDialog } from './components/Toolbar';

function App() {
  const [showVoltageDialog, setShowVoltageDialog] = useState(false);
  const [pendingPowerNode, setPendingPowerNode] = useState<{x: number, y: number} | null>(null);

  const handleCanvasClick = (x: number, y: number) => {
    if (currentTool === 'power') {
      // Store position and show voltage dialog
      setPendingPowerNode({ x, y });
      setShowVoltageDialog(true);
    }
  };

  const handleVoltageSelect = (voltage: string) => {
    if (pendingPowerNode) {
      // Create power node
      const powerNode: PowerNode = {
        id: generateUniqueId('pwr'),
        x: pendingPowerNode.x,
        y: pendingPowerNode.y,
        voltage,
        color: brushColor,
        size: brushSize,
      };
      setPowerNodes(prev => [...prev, powerNode]);
    }
    setShowVoltageDialog(false);
    setPendingPowerNode(null);
  };

  return (
    <>
      <Toolbar {...toolbarProps} />
      <Canvas onClick={handleCanvasClick} />
      <VoltageDialog
        isOpen={showVoltageDialog}
        onSelect={handleVoltageSelect}
        onCancel={() => {
          setShowVoltageDialog(false);
          setPendingPowerNode(null);
        }}
      />
    </>
  );
}
```

## File Structure

```
src/components/Toolbar/
├── Toolbar.tsx           # Main component
├── ToolButton.tsx        # Individual tool button
├── BrushSizeSlider.tsx   # Brush size slider
├── SizePresets.tsx       # Quick size buttons
├── VoltageDialog.tsx     # Power voltage selector
├── Toolbar.css           # Styles
├── index.ts              # Exports
└── README.md             # This file
```

## Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';

test('renders all tool buttons', () => {
  const onToolChange = jest.fn();
  const onBrushSizeChange = jest.fn();
  const onColorPickerClick = jest.fn();

  render(
    <Toolbar
      currentTool="none"
      onToolChange={onToolChange}
      brushColor="#ff0000"
      brushSize={10}
      onBrushSizeChange={onBrushSizeChange}
      onColorPickerClick={onColorPickerClick}
    />
  );

  expect(screen.getByText(/Select/)).toBeInTheDocument();
  expect(screen.getByText(/Via/)).toBeInTheDocument();
  expect(screen.getByText(/Trace/)).toBeInTheDocument();
  // ... etc
});

test('calls onToolChange when tool button clicked', () => {
  const onToolChange = jest.fn();

  render(
    <Toolbar
      currentTool="none"
      onToolChange={onToolChange}
      brushColor="#ff0000"
      brushSize={10}
      onBrushSizeChange={jest.fn()}
      onColorPickerClick={jest.fn()}
    />
  );

  fireEvent.click(screen.getByText(/Select/));
  expect(onToolChange).toHaveBeenCalledWith('select');
});
```

## Notes

- Tool icons use Unicode symbols for now; consider replacing with SVG icons for better visual quality
- The Trace and Via tools both use the 'draw' tool type internally; differentiate them in your app logic
- Color-reflective tools (Via, Trace, Component, Power, Ground) automatically update their icon color when `brushColor` changes
- The Zoom tool icon changes based on `isShiftPressed` prop (+ for zoom in, - for zoom out)

