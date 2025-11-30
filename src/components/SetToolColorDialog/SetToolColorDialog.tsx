/**
 * Copyright 2025 Philip L. Giacalone
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * SetToolColorDialog component
 * Dialog for setting tool colors with separate Top/Bottom options for layer-specific tools
 */

import React from 'react';
import type { Tool, ToolDefinition, ToolSettings } from '../../hooks/useToolRegistry';

export interface SetToolColorDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Tool registry */
  toolRegistry: Map<string, ToolDefinition>;
  /** Current tool */
  currentTool: Tool;
  /** Current drawing mode */
  drawingMode: 'trace' | 'via' | 'pad';
  /** Trace tool layer */
  traceToolLayer: 'top' | 'bottom';
  /** Pad tool layer */
  padToolLayer: 'top' | 'bottom';
  /** Component tool layer */
  componentToolLayer: 'top' | 'bottom';
  /** Callback to update tool settings */
  updateToolSettings: (toolId: string, settings: ToolSettings) => void;
  /** Callback to update tool layer settings */
  updateToolLayerSettings: (toolId: string, layer: 'top' | 'bottom', settings: ToolSettings) => void;
  /** Callback to save tool settings */
  saveToolSettings: (toolId: string, color: string, size: number) => void;
  /** Callback to save tool layer settings */
  saveToolLayerSettings: (toolId: string, layer: 'top' | 'bottom', color: string, size: number) => void;
  /** Callback to set brush color */
  setBrushColor: (color: string | ((prev: string) => string)) => void;
  /** Layer-specific color setters */
  setTopTraceColor: (color: string) => void;
  setBottomTraceColor: (color: string) => void;
  setTopPadColor: (color: string) => void;
  setBottomPadColor: (color: string) => void;
  setTopComponentColor: (color: string) => void;
  setBottomComponentColor: (color: string) => void;
  /** Legacy save function */
  saveDefaultColor: (type: 'via' | 'pad' | 'trace' | 'component' | 'brush', color: string, layer?: 'top' | 'bottom') => void;
  /** Color palette */
  colorPalette: string[];
  /** Layer-specific color getters (for syncing registry with state) */
  topTraceColor: string;
  bottomTraceColor: string;
  topPadColor: string;
  bottomPadColor: string;
  topComponentColor: string;
  bottomComponentColor: string;
  /** Callback to close the dialog */
  onClose: () => void;
}

export const SetToolColorDialog: React.FC<SetToolColorDialogProps> = ({
  visible,
  toolRegistry,
  currentTool,
  drawingMode,
  traceToolLayer,
  padToolLayer,
  componentToolLayer,
  updateToolSettings,
  updateToolLayerSettings,
  saveToolSettings,
  saveToolLayerSettings,
  setBrushColor,
  setTopTraceColor,
  setBottomTraceColor,
  setTopPadColor,
  setBottomPadColor,
  setTopComponentColor,
  setBottomComponentColor,
  saveDefaultColor,
  colorPalette,
  topTraceColor,
  bottomTraceColor,
  topPadColor,
  bottomPadColor,
  topComponentColor,
  bottomComponentColor,
  onClose,
}) => {
  const [openColorPicker, setOpenColorPicker] = React.useState<{ toolId: string; layer?: 'top' | 'bottom' } | null>(null);

  if (!visible) return null;

  // Tools that have layer-specific colors (Top/Bottom)
  const layerTools = ['pad', 'trace', 'component'];
  
  // Tool definitions - ordered to match toolbar order: Via, Pad, Trace, Component, Power, Ground, Erase
  // Layer-specific tools shown as separate entries (Top then Bottom)
  const toolEntries: Array<{ id: string; name: string; layer?: 'top' | 'bottom' }> = [
    { id: 'via', name: 'Via' },
    { id: 'pad', name: 'Pad', layer: 'top' },
    { id: 'pad', name: 'Pad', layer: 'bottom' },
    { id: 'trace', name: 'Trace', layer: 'top' },
    { id: 'trace', name: 'Trace', layer: 'bottom' },
    { id: 'component', name: 'Component', layer: 'top' },
    { id: 'component', name: 'Component', layer: 'bottom' },
    { id: 'power', name: 'Power' },
    { id: 'ground', name: 'Ground' },
    { id: 'erase', name: 'Erase' },
  ];

  const handleColorChange = (toolId: string, color: string, layer?: 'top' | 'bottom') => {
    const toolDef = toolRegistry.get(toolId);
    if (!toolDef) return;

    if (layer && layerTools.includes(toolId)) {
      // Update layer-specific settings
      const layerSettings = toolDef.layerSettings.get(layer);
      const currentSize = layerSettings?.size || toolDef.settings.size;
      
      // Update layer-specific state immediately (following Set Tool Size pattern)
      if (toolId === 'trace') {
        if (layer === 'top') {
          setTopTraceColor(color);
          saveDefaultColor('trace', color, 'top');
        } else {
          setBottomTraceColor(color);
          saveDefaultColor('trace', color, 'bottom');
        }
      } else if (toolId === 'pad') {
        if (layer === 'top') {
          setTopPadColor(color);
          saveDefaultColor('pad', color, 'top');
        } else {
          setBottomPadColor(color);
          saveDefaultColor('pad', color, 'bottom');
        }
      } else if (toolId === 'component') {
        if (layer === 'top') {
          setTopComponentColor(color);
          saveDefaultColor('component', color, 'top');
        } else {
          setBottomComponentColor(color);
          saveDefaultColor('component', color, 'bottom');
        }
      }
      
      const newLayerSettings: ToolSettings = {
        color,
        size: currentSize,
      };
      updateToolLayerSettings(toolId, layer, newLayerSettings);
      saveToolLayerSettings(toolId, layer, color, currentSize);
      
      // If this tool is currently active and this layer is selected, update brushColor immediately
      const isActiveTool = 
        (toolId === 'trace' && currentTool === 'draw' && drawingMode === 'trace') ||
        (toolId === 'pad' && currentTool === 'draw' && drawingMode === 'pad') ||
        (toolId === 'component' && currentTool === 'component');
      
      if (isActiveTool) {
        const activeLayer = 
          (toolId === 'trace' ? traceToolLayer : toolId === 'pad' ? padToolLayer : componentToolLayer) || 'top';
        if (activeLayer === layer) {
          // Update brushColor immediately so subsequent drawings use the new color
          setBrushColor(color);
        }
      }
    } else {
      // For non-layer tools, just update general settings
      const newSettings: ToolSettings = {
        ...toolDef.settings,
        color,
      };
      updateToolSettings(toolId, newSettings);
      saveToolSettings(toolId, color, toolDef.settings.size);
      
      // If this tool is currently active, update brushColor immediately
      const isActiveTool = 
        (toolId === 'via' && currentTool === 'draw' && drawingMode === 'via') ||
        (toolId === 'power' && currentTool === 'power') ||
        (toolId === 'ground' && currentTool === 'ground') ||
        (toolId === 'erase' && currentTool === 'erase');
      
      if (isActiveTool) {
        setBrushColor(color);
      }
      
      // Save default color for legacy support
      if (toolId === 'via') {
        saveDefaultColor('via', color);
      } else if (toolId === 'erase') {
        saveDefaultColor('brush', color);
      }
      // Note: power and ground colors are saved via updateToolSettings above
    }
    
    setOpenColorPicker(null);
  };

  const renderColorPicker = (toolId: string, layer?: 'top' | 'bottom') => {
    const toolDef = toolRegistry.get(toolId);
    if (!toolDef) return null;
    
    // Get current color from tool registry (one source of truth)
    // For layer-specific tools, read from layerSettings, fallback to settings.color
    const currentColor = layer && layerTools.includes(toolId)
      ? toolDef.layerSettings.get(layer)?.color ?? toolDef.settings.color ?? '#000000'
      : toolDef.settings.color ?? '#000000';
    
    const pickerKey = layer ? `${toolId}-${layer}` : toolId;
    const isOpen = openColorPicker?.toolId === toolId && openColorPicker?.layer === layer;

    return (
      <div key={`${pickerKey}-${currentColor}`} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          key={`${pickerKey}-button-${currentColor}`}
          className="color-swatch-button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenColorPicker(isOpen ? null : { toolId, layer });
          }}
          style={{
            width: '40px',
            height: '24px',
            background: currentColor,
            backgroundColor: currentColor,
            backgroundImage: 'none',
            border: '1px solid #3a3a44',
            borderRadius: 3,
            cursor: 'pointer',
            padding: 0,
            margin: 0,
            display: 'block',
            '--swatch-color': currentColor,
          } as React.CSSProperties & { '--swatch-color': string }}
          title={currentColor}
        />
        {isOpen && (
          <div
            onClick={(e) => { e.stopPropagation(); }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              padding: 8,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 6,
              boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
              zIndex: 100,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 4 }}>
              {colorPalette.map((c) => (
                <div
                  key={c}
                  onClick={() => handleColorChange(toolId, c, layer)}
                  title={c}
                  style={{
                    width: 22,
                    height: 22,
                    backgroundColor: c,
                    border: c === currentColor ? '2px solid #333' : '1px solid #ccc',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10004,
      }}
      onClick={(e) => {
        // Close dialog if clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
          setOpenColorPicker(null);
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#2b2b31',
          borderRadius: 8,
          padding: '16px',
          width: 'fit-content',
          maxWidth: '600px',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1f1f24',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>
          Set Tool Color
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {toolEntries.map((entry, index) => {
            const toolDef = toolRegistry.get(entry.id);
            if (!toolDef) return null;
            
            const displayName = entry.layer ? `${entry.name} (${entry.layer === 'top' ? 'Top' : 'Bottom'})` : entry.name;
            
            return (
              <div
                key={`${entry.id}-${entry.layer || 'default'}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: '#1f1f24',
                  borderRadius: 4,
                }}
              >
                <label
                  style={{
                    color: '#f2f2f2',
                    fontSize: '13px',
                    width: '140px',
                    flexShrink: 0,
                    marginRight: '8px',
                  }}
                >
                  {displayName}:
                </label>
                {renderColorPicker(entry.id, entry.layer)}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={() => {
              onClose();
              setOpenColorPicker(null);
            }}
            style={{
              padding: '6px 12px',
              background: '#4CAF50',
              color: '#fff',
              border: '1px solid #45a049',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

