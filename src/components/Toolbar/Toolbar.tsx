/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
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
  onProjectNotesClick?: () => void;
  onTestPointsClick?: () => void;
  onInformationClick?: () => void;
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
  onProjectNotesClick,
  onTestPointsClick,
  onInformationClick,
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

      {/* Information Icon Button */}
      {onInformationClick && (
        <button
          className="toolbar-icon-button"
          onClick={onInformationClick}
          title="Information (I)"
          aria-label="Open information dialog"
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.borderColor = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = '#ccc';
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#4A90E2" />
            <rect x="10.5" y="6" width="3" height="3" rx="1.5" fill="white" />
            <rect x="10.5" y="11" width="3" height="7" rx="1.5" fill="white" />
          </svg>
        </button>
      )}

      {/* Project Notes Icon Button */}
      {onProjectNotesClick && (
        <button
          className="toolbar-icon-button"
          onClick={onProjectNotesClick}
          title="Project Notes"
          aria-label="Open project notes"
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.borderColor = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = '#ccc';
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="3" height="3" rx="0.5" fill="white" />
            <rect x="9" y="6" width="11" height="2" rx="0.5" fill="white" />
            <rect x="4" y="11" width="3" height="3" rx="0.5" fill="white" />
            <rect x="9" y="11" width="11" height="2" rx="0.5" fill="white" />
            <rect x="4" y="16" width="3" height="3" rx="0.5" fill="white" />
            <rect x="9" y="16" width="11" height="2" rx="0.5" fill="white" />
          </svg>
        </button>
      )}

      {/* Test Points Icon Button */}
      {onTestPointsClick && (
        <button
          className="toolbar-icon-button"
          onClick={onTestPointsClick}
          title="Test Points"
          aria-label="Open test points list"
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.borderColor = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = '#ccc';
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="white" opacity="0.3" />
            <circle cx="6" cy="6" r="1.5" fill="white" />
            <rect x="9" y="5" width="9" height="2" rx="0.5" fill="white" />
            <rect x="9" y="4" width="5" height="1" rx="0.5" fill="white" />
            <circle cx="6" cy="10" r="1.5" fill="white" />
            <rect x="9" y="9" width="9" height="2" rx="0.5" fill="white" />
            <rect x="9" y="8" width="5" height="1" rx="0.5" fill="white" />
            <circle cx="6" cy="14" r="1.5" fill="white" />
            <rect x="9" y="13" width="9" height="2" rx="0.5" fill="white" />
            <rect x="9" y="12" width="5" height="1" rx="0.5" fill="white" />
          </svg>
        </button>
      )}

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

