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

/**
 * SetToolColorDialog component
 * Dialog for setting tool colors with separate Top/Bottom options for layer-specific tools
 */

import React from 'react';
import type { Tool, ToolDefinition, ToolSettings } from '../../hooks/useToolRegistry';
import { toolInstanceManager, getToolInstanceId, type ToolInstanceId } from '../../utils/toolInstances';

export interface SetToolColorDialogProps {
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
  setTopTestPointColor: (color: string) => void;
  setBottomTestPointColor: (color: string) => void;
  setTopComponentColor: (color: string) => void;
  setBottomComponentColor: (color: string) => void;
  setComponentConnectionColor: (color: string) => void;
  /** Save default color function */
  saveDefaultColor: (type: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'componentConnection' | 'brush', color: string, layer?: 'top' | 'bottom') => void;
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
  testPointToolLayer,
  componentToolLayer,
  updateToolSettings,
  updateToolLayerSettings,
  saveToolSettings,
  saveToolLayerSettings,
  setBrushColor,
  // Props kept for API compatibility but not used
  setTopTraceColor: _setTopTraceColor,
  setBottomTraceColor: _setBottomTraceColor,
  setTopPadColor: _setTopPadColor,
  setBottomPadColor: _setBottomPadColor,
  setTopTestPointColor: _setTopTestPointColor,
  setBottomTestPointColor: _setBottomTestPointColor,
  setTopComponentColor: _setTopComponentColor,
  setBottomComponentColor: _setBottomComponentColor,
  setComponentConnectionColor,
  saveDefaultColor,
  colorPalette,
  onClose,
}) => {
  const [openColorPicker, setOpenColorPicker] = React.useState<{ toolId: string; layer?: 'top' | 'bottom' } | null>(null);
  const [colorUpdateTrigger, setColorUpdateTrigger] = React.useState(0);

  // Subscribe to tool instance changes to trigger re-renders when colors change
  React.useEffect(() => {
    const unsubscribeCallbacks: (() => void)[] = [];
    
    // Subscribe to all tool instances that are shown in the dialog
    const toolIds: Array<{ id: string; layer?: 'top' | 'bottom' }> = [
      { id: 'via' },
      { id: 'pad', layer: 'top' },
      { id: 'pad', layer: 'bottom' },
      { id: 'testPoint', layer: 'top' },
      { id: 'testPoint', layer: 'bottom' },
      { id: 'trace', layer: 'top' },
      { id: 'trace', layer: 'bottom' },
      { id: 'component', layer: 'top' },
      { id: 'component', layer: 'bottom' },
      { id: 'power' },
      { id: 'ground' },
    ];
    
    toolIds.forEach(({ id, layer }) => {
      try {
        const toolInstanceId = getToolInstanceId(id as any, layer);
        const unsubscribe = toolInstanceManager.subscribe(toolInstanceId, () => {
          setColorUpdateTrigger(prev => prev + 1);
        });
        unsubscribeCallbacks.push(unsubscribe);
      } catch {
        // Tool doesn't have a tool instance, skip
      }
    });
    
    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  if (!visible) return null;

  // Tools that have layer-specific colors (Top/Bottom)
    const layerTools = ['pad', 'testPoint', 'trace', 'component'];
  
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

  const handleColorChange = (toolId: string, color: string, layer?: 'top' | 'bottom') => {
    // Handle component connections specially (not a tool instance)
    if (toolId === 'componentConnection') {
      setComponentConnectionColor(color);
      saveDefaultColor('componentConnection', color);
      setOpenColorPicker(null);
      return;
    }
    
    // Handle erase tool (not a tool instance, uses toolRegistry)
    if (toolId === 'erase') {
      const toolDef = toolRegistry.get(toolId);
      if (toolDef) {
        updateToolSettings(toolId, { ...toolDef.settings, color });
        saveToolSettings(toolId, color, toolDef.settings.size);
      }
      setOpenColorPicker(null);
      return;
    }

    // For tools with tool instances, update the tool instance (single source of truth)
    try {
      let toolInstanceId: ToolInstanceId;
      
      if (layer && layerTools.includes(toolId)) {
        // Layer-specific tools
        toolInstanceId = getToolInstanceId(toolId as any, layer);
      } else {
        // Non-layer tools (via, power, ground)
        toolInstanceId = getToolInstanceId(toolId as any);
      }
      
      // Update tool instance color
      toolInstanceManager.setColor(toolInstanceId, color);
      
      // If this tool is currently active, update brushColor immediately
      const isActiveTool = 
        (toolId === 'via' && currentTool === 'draw' && drawingMode === 'via') ||
        (toolId === 'trace' && currentTool === 'draw' && drawingMode === 'trace') ||
        (toolId === 'pad' && currentTool === 'draw' && drawingMode === 'pad') ||
        (toolId === 'testPoint' && currentTool === 'draw' && drawingMode === 'testPoint') ||
        (toolId === 'component' && currentTool === 'component') ||
        (toolId === 'power' && currentTool === 'power') ||
        (toolId === 'ground' && currentTool === 'ground');
      
      if (isActiveTool) {
        // For layer-specific tools, only update brushColor if the active layer matches
        if (layer && layerTools.includes(toolId)) {
          const activeLayer = 
            (toolId === 'trace' ? traceToolLayer : toolId === 'pad' ? padToolLayer : toolId === 'testPoint' ? testPointToolLayer : componentToolLayer) || 'top';
          if (activeLayer === layer) {
            setBrushColor(color);
          }
        } else {
          // For non-layer tools, always update brushColor if active
          setBrushColor(color);
        }
      }
    } catch (error) {
      console.error(`Error updating color for tool ${toolId}:`, error);
      // Fall back to toolRegistry for tools without tool instances
      const toolDef = toolRegistry.get(toolId);
      if (toolDef) {
        if (layer && layerTools.includes(toolId)) {
          updateToolLayerSettings(toolId, layer, { ...toolDef.layerSettings.get(layer)!, color });
          saveToolLayerSettings(toolId, layer, color, toolDef.layerSettings.get(layer)?.size || toolDef.settings.size);
        } else {
          updateToolSettings(toolId, { ...toolDef.settings, color });
          saveToolSettings(toolId, color, toolDef.settings.size);
        }
      }
    }
    
    setOpenColorPicker(null);
  };

  const renderColorPicker = (toolId: string, layer?: 'top' | 'bottom') => {
    // Get current color from tool instance manager (single source of truth) to match toolbar
    // For tools without tool instances (componentConnection, erase), fall back to toolRegistry
    let currentColor: string;
    try {
      const toolInstanceId = getToolInstanceId(toolId as any, layer);
      const toolInstance = toolInstanceManager.get(toolInstanceId);
      currentColor = toolInstance.color;
    } catch {
      // Fall back to toolRegistry for tools without tool instances (componentConnection, erase)
      const toolDef = toolRegistry.get(toolId);
      if (!toolDef) return null;
      currentColor = toolDef.settings.color ?? '#000000';
    }
    
    const pickerKey = layer ? `${toolId}-${layer}` : toolId;
    const isOpen = openColorPicker?.toolId === toolId && openColorPicker?.layer === layer;

    return (
      <div key={`${pickerKey}-${currentColor}-${colorUpdateTrigger}`} style={{ position: 'relative', display: 'inline-block', zIndex: 10005 }}>
        <button
          key={`${pickerKey}-button-${currentColor}-${colorUpdateTrigger}`}
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
              top: 0,
              left: '100%',
              marginLeft: '4px',
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
          minWidth: '450px',
          maxWidth: '600px',
          maxHeight: '70vh',
          overflowY: 'auto',
          overflowX: 'visible',
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

