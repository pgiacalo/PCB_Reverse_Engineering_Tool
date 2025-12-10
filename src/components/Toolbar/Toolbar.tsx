/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import { ToolButton } from './ToolButton';
import { BrushSizeSlider } from './BrushSizeSlider';
import { SizePresets } from './SizePresets';
import type { Tool } from '../../types';
import './Toolbar.css';

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  brushColor: string;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onColorPickerClick: () => void;
  isShiftPressed?: boolean;
  drawingMode?: 'trace' | 'via' | 'pad' | 'testPoint';
  onDrawingModeChange?: (mode: 'trace' | 'via' | 'pad' | 'testPoint') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onToolChange,
  brushColor,
  brushSize,
  onBrushSizeChange,
  onColorPickerClick,
  isShiftPressed = false,
  drawingMode = 'trace',
  onDrawingModeChange,
}) => {
  // Tool definitions with icons (using Unicode symbols for now)
  const tools = [
    {
      tool: 'select' as Tool,
      icon: '⊕',
      label: 'Select',
      shortcut: 'S',
      tooltip: 'Select objects or groups',
      colorReflective: false,
      mode: undefined,
    },
    {
      tool: 'draw' as Tool,
      icon: '◎',
      label: 'Via',
      shortcut: 'V',
      tooltip: 'Place via connection',
      colorReflective: true,
      mode: 'via' as const,
    },
    {
      tool: 'draw' as Tool,
      icon: '▢',
      label: 'Pad',
      shortcut: 'P',
      tooltip: 'Place pad connection',
      colorReflective: true,
      mode: 'pad' as const,
    },
    {
      tool: 'draw' as Tool,
      icon: '◆',
      label: 'Test Point',
      shortcut: '',
      tooltip: 'Place test point',
      colorReflective: true,
      mode: 'testPoint' as const,
    },
    {
      tool: 'draw' as Tool, // Trace uses draw mode
      icon: '╱',
      label: 'Trace',
      shortcut: 'T',
      tooltip: 'Draw copper traces',
      colorReflective: true,
      mode: 'trace' as const,
    },
    {
      tool: 'component' as Tool,
      icon: '▭',
      label: 'Component',
      shortcut: 'C',
      tooltip: 'Place component',
      colorReflective: true,
      mode: undefined,
    },
    {
      tool: 'power' as Tool,
      icon: '⊕',
      label: 'Power',
      shortcut: 'B',
      tooltip: 'Place power node',
      colorReflective: true,
      mode: undefined,
    },
    {
      tool: 'ground' as Tool,
      icon: '⏚',
      label: 'Ground',
      shortcut: 'G',
      tooltip: 'Place ground symbol',
      colorReflective: true,
      mode: undefined,
    },
    {
      tool: 'erase' as Tool,
      icon: '▭',
      label: 'Erase',
      shortcut: 'E',
      tooltip: 'Erase objects',
      colorReflective: false,
      mode: undefined,
    },
    {
      tool: 'pan' as Tool,
      icon: '✋',
      label: 'Move',
      shortcut: 'H',
      tooltip: 'Pan the view',
      colorReflective: false,
      mode: undefined,
    },
    {
      tool: 'magnify' as Tool,
      icon: isShiftPressed ? '🔍−' : '🔍+',
      label: 'Zoom',
      shortcut: 'M',
      tooltip: 'Magnify',
      colorReflective: false,
      mode: undefined,
    },
  ];

  const handleToolClick = (tool: Tool, mode?: 'trace' | 'via' | 'pad' | 'testPoint') => {
    if (mode && onDrawingModeChange) {
      onDrawingModeChange(mode);
    }
    onToolChange(tool);
  };

  return (
    <div className="toolbar">
      {/* Tool Buttons */}
      <div className="tool-buttons">
        {tools.map((toolDef) => {
          // For draw tools, check both tool and mode
          const isActive = toolDef.mode 
            ? currentTool === toolDef.tool && drawingMode === toolDef.mode
            : currentTool === toolDef.tool;
          
          return (
            <ToolButton
              key={`${toolDef.tool}-${toolDef.label}`}
              tool={toolDef.tool}
              icon={toolDef.icon}
              label={toolDef.label}
              shortcut={toolDef.shortcut}
              tooltip={toolDef.tooltip}
              isActive={isActive}
              onClick={() => handleToolClick(toolDef.tool, toolDef.mode)}
              color={toolDef.colorReflective ? brushColor : undefined}
            />
          );
        })}
      </div>

      {/* Separator */}
      <div className="toolbar-separator" />

      {/* Color Picker Button */}
      <button
        className="color-picker-button"
        onClick={onColorPickerClick}
        title="Color Picker"
        aria-label="Open color picker"
      >
        <div
          className="color-picker-swatch"
          style={{ backgroundColor: brushColor }}
        />
        <div className="color-picker-label">
          Color Picker
          <div className="color-picker-value">{brushColor}</div>
        </div>
      </button>

      {/* Separator */}
      <div className="toolbar-separator" />

      {/* Brush Size Controls */}
      <div className="brush-size-controls">
        <BrushSizeSlider
          value={brushSize}
          onChange={onBrushSizeChange}
          color={brushColor}
        />
        <SizePresets
          currentSize={brushSize}
          onSizeSelect={onBrushSizeChange}
          color={brushColor}
        />
      </div>
    </div>
  );
};

