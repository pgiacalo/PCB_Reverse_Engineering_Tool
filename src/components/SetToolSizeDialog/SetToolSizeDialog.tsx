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
 * SetToolSizeDialog component
 * Dialog for setting tool sizes with separate Top/Bottom options for layer-specific tools
 */

import React from 'react';
import type { Tool, ToolDefinition, ToolSettings } from '../../hooks/useToolRegistry';
import { toolInstanceManager, getToolInstanceId } from '../../utils/toolInstances';

export interface SetToolSizeDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Tool registry */
  toolRegistry: Map<string, ToolDefinition>;
  /** Current tool */
  currentTool: Tool;
  /** Current drawing mode */
  drawingMode: 'trace' | 'via' | 'pad' | 'testPoint';
  /** Trace tool layer */
  traceToolLayer: 'top' | 'bottom';
  /** Pad tool layer */
  padToolLayer: 'top' | 'bottom';
  /** Test Point tool layer */
  testPointToolLayer: 'top' | 'bottom';
  /** Component tool layer */
  componentToolLayer: 'top' | 'bottom';
  /** Callback to update tool settings */
  updateToolSettings: (toolId: string, settings: ToolSettings) => void;
  /** Callback to update tool layer settings */
  updateToolLayerSettings: (toolId: string, layer: 'top' | 'bottom', settings: ToolSettings) => void;
  /** Callback to set brush size */
  setBrushSize: (size: number | ((prev: number) => number)) => void;
  /** Callback to save tool settings */
  saveToolSettings: (toolId: string, color: string, size: number) => void;
  /** Callback to save tool layer settings */
  saveToolLayerSettings: (toolId: string, layer: 'top' | 'bottom', color: string, size: number) => void;
  /** Layer-specific size setters */
  setTopTraceSize: (size: number) => void;
  setBottomTraceSize: (size: number) => void;
  setTopPadSize: (size: number) => void;
  setBottomPadSize: (size: number) => void;
  setTopTestPointSize: (size: number) => void;
  setBottomTestPointSize: (size: number) => void;
  setTopComponentSize: (size: number) => void;
  setBottomComponentSize: (size: number) => void;
  setComponentConnectionSize: (size: number) => void;
  /** Legacy save function */
  saveDefaultSize: (toolType: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'componentConnection' | 'power' | 'ground' | 'brush', size: number, layer?: 'top' | 'bottom') => void;
  /** Callback to close the dialog */
  onClose: () => void;
}

export const SetToolSizeDialog: React.FC<SetToolSizeDialogProps> = ({
  visible,
  toolRegistry,
  currentTool,
  drawingMode,
  traceToolLayer,
  padToolLayer,
  testPointToolLayer,
  componentToolLayer,
  updateToolSettings,
  updateToolLayerSettings,
  setBrushSize,
  saveToolSettings,
  saveToolLayerSettings,
  setTopTraceSize,
  setBottomTraceSize,
  setTopPadSize,
  setBottomPadSize,
  setTopTestPointSize,
  setBottomTestPointSize,
  setTopComponentSize,
  setBottomComponentSize,
  setComponentConnectionSize,
  saveDefaultSize,
  onClose,
}) => {
  if (!visible) return null;

  // Generate size options (1-50)
  const sizeOptions = Array.from({ length: 50 }, (_, i) => i + 1);

  // Tool definitions - ordered to match toolbar order: Via, Pad, Trace, Component, Power, Ground, Erase
  // Layer-specific tools shown as separate entries (Top then Bottom)
  const toolEntries: Array<{ id: string; name: string; layer?: 'top' | 'bottom' }> = [
    { id: 'via', name: 'Via' },
    { id: 'pad', name: 'Pad', layer: 'top' },
    { id: 'pad', name: 'Pad', layer: 'bottom' },
    { id: 'testPoint', name: 'Test Point', layer: 'top' },
    { id: 'testPoint', name: 'Test Point', layer: 'bottom' },
    { id: 'trace', name: 'Trace', layer: 'top' },
    { id: 'trace', name: 'Trace', layer: 'bottom' },
    { id: 'component', name: 'Component', layer: 'top' },
    { id: 'component', name: 'Component', layer: 'bottom' },
    { id: 'componentConnection', name: 'Component Connections' },
    { id: 'power', name: 'Power' },
    { id: 'ground', name: 'Ground' },
    { id: 'erase', name: 'Erase' },
  ];

  const handleSizeChange = (toolId: string, newSize: number, layer?: 'top' | 'bottom') => {
    const toolDef = toolRegistry.get(toolId);
    if (!toolDef) return;

    // For layer-specific tools (trace, pad, testPoint, component), update layer-specific settings
    const layerTools = ['trace', 'pad', 'testPoint', 'component'];
    if (layerTools.includes(toolId) && layer) {
      // Update layer-specific settings
      const layerSettings = toolDef.layerSettings.get(layer);
      const currentColor = layerSettings?.color || toolDef.settings.color;
      
      // Update tool instance directly (single source of truth)
      const toolInstanceId = getToolInstanceId(toolId as any, layer);
      toolInstanceManager.setSize(toolInstanceId, newSize);
      
      // If this tool is currently active and this layer is selected, update brushSize immediately
      const isActiveTool = 
        (toolId === 'trace' && currentTool === 'draw' && drawingMode === 'trace') ||
        (toolId === 'pad' && currentTool === 'draw' && drawingMode === 'pad') ||
        (toolId === 'testPoint' && currentTool === 'draw' && drawingMode === 'testPoint') ||
        (toolId === 'component' && currentTool === 'component');
      
      if (isActiveTool) {
        const activeLayer = 
          (toolId === 'trace' ? traceToolLayer : toolId === 'pad' ? padToolLayer : toolId === 'testPoint' ? testPointToolLayer : componentToolLayer) || 'top';
        if (activeLayer === layer) {
          // Update brushSize immediately so subsequent drawings use the new size
          setBrushSize(newSize);
        }
      }
    } else {
      // For non-layer tools, update tool instance directly
      const toolInstanceId = getToolInstanceId(toolId as any);
      if (toolInstanceId) {
        toolInstanceManager.setSize(toolInstanceId, newSize);
        
        // If this tool is currently active, update brushSize immediately
        const isActiveTool = 
          (toolId === 'via' && currentTool === 'draw' && drawingMode === 'via') ||
          (toolId === 'power' && currentTool === 'power') ||
          (toolId === 'ground' && currentTool === 'ground');
        
        if (isActiveTool) {
          setBrushSize(newSize);
        }
      }
      
      // Handle component connections specially (not a tool instance)
      if (toolId === 'componentConnection') {
        setComponentConnectionSize(newSize);
        saveDefaultSize('componentConnection', newSize);
      }
      
      // Handle erase tool (not a tool instance, uses toolRegistry)
      if (toolId === 'erase' && currentTool === 'erase') {
        setBrushSize(newSize);
      }
    }
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
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#2b2b31',
          borderRadius: 8,
          padding: '16px',
          width: 'fit-content',
          maxWidth: '400px',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1f1f24',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>
          Set Tool Size
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {toolEntries.map((entry, index) => {
            const toolDef = toolRegistry.get(entry.id);
            if (!toolDef) return null;
            
            const displayName = entry.layer ? `${entry.name} (${entry.layer === 'top' ? 'Top' : 'Bottom'})` : entry.name;
            // Get current size from tool registry (one source of truth)
            const currentSize = entry.layer
              ? toolDef.layerSettings.get(entry.layer)?.size ?? toolDef.settings.size ?? 10
              : toolDef.settings.size ?? 10;
            
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <select
                    value={currentSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      handleSizeChange(entry.id, newSize, entry.layer);
                    }}
                    style={{
                      width: '50px',
                      padding: '4px 6px',
                      background: '#2b2b31',
                      border: '1px solid #3a3a44',
                      borderRadius: 4,
                      color: '#f2f2f2',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {sizeOptions.map(size => (
                      <option key={size} value={size} style={{ background: '#2b2b31', color: '#f2f2f2' }}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: '#f2f2f2', fontSize: '12px' }}>px</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={onClose}
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

