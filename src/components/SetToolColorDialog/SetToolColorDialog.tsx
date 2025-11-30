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
  /** Color palette */
  colorPalette: string[];
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
  colorPalette,
  onClose,
}) => {
  const [openColorPicker, setOpenColorPicker] = React.useState<{ toolId: string; layer?: 'top' | 'bottom' } | null>(null);

  if (!visible) return null;

  // Tools that have layer-specific colors (Top/Bottom)
  const layerTools = ['pad', 'trace', 'component'];
  
  // Tool definitions - layer-specific tools shown as separate entries
  const toolEntries: Array<{ id: string; name: string; layer?: 'top' | 'bottom' }> = [
    { id: 'select', name: 'Select' },
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
      const newLayerSettings: ToolSettings = {
        color,
        size: layerSettings?.size || toolDef.settings.size,
      };
      updateToolLayerSettings(toolId, layer, newLayerSettings);
      saveToolLayerSettings(toolId, layer, color, layerSettings?.size || toolDef.settings.size);
    } else {
      // Update general tool settings
      const newSettings: ToolSettings = {
        ...toolDef.settings,
        color,
      };
      updateToolSettings(toolId, newSettings);
      saveToolSettings(toolId, color, toolDef.settings.size);
    }
    
    setOpenColorPicker(null);
  };

  const renderColorPicker = (toolId: string, layer?: 'top' | 'bottom') => {
    const toolDef = toolRegistry.get(toolId);
    if (!toolDef) return null;
    
    const currentColor = layer && layerTools.includes(toolId)
      ? toolDef.layerSettings.get(layer)?.color || toolDef.settings.color
      : toolDef.settings.color;
    
    const pickerKey = layer ? `${toolId}-${layer}` : toolId;
    const isOpen = openColorPicker?.toolId === toolId && openColorPicker?.layer === layer;

    return (
      <div key={pickerKey} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenColorPicker(isOpen ? null : { toolId, layer });
          }}
          style={{
            width: '40px',
            height: '24px',
            backgroundColor: currentColor,
            border: '1px solid #3a3a44',
            borderRadius: 3,
            cursor: 'pointer',
            marginLeft: '8px',
          }}
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
          padding: '24px',
          minWidth: '400px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1f1f24',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '18px', fontWeight: 600 }}>
          Set Tool Color
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#1f1f24',
                  borderRadius: 4,
                }}
              >
                <label
                  style={{
                    color: '#f2f2f2',
                    fontSize: '14px',
                    flex: '0 0 auto',
                    marginRight: '16px',
                    minWidth: '150px',
                  }}
                >
                  {displayName}:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                  {renderColorPicker(entry.id, entry.layer)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
          <button
            onClick={() => {
              onClose();
              setOpenColorPicker(null);
            }}
            style={{
              padding: '8px 16px',
              background: '#4CAF50',
              color: '#fff',
              border: '1px solid #45a049',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '14px',
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

