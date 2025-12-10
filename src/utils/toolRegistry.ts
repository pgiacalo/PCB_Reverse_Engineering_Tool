/**
 * Copyright (c) 2025 Philip L. Giacalone
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
 * Tool Registry Utilities
 * 
 * Functions for creating and managing the tool registry.
 * Extracted from App.tsx to reduce file size.
 */

import type { ComponentType } from '../types';
import type { Layer, ToolSettings, ToolDefinition } from '../hooks';
import { 
  COMPONENT_TYPE_INFO,
  DEFAULT_VIA_COLOR, 
  DEFAULT_TRACE_COLOR, 
  DEFAULT_COMPONENT_COLOR, 
  DEFAULT_GROUND_COLOR,
  DEFAULT_PAD_COLOR,
  DEFAULT_POWER_COLOR,
  VIA,
  COMPONENT_ICON,
} from '../constants';

// Helper function to get default abbreviation from component type
export const getDefaultAbbreviation = (componentType: ComponentType): string => {
  const info = COMPONENT_TYPE_INFO[componentType];
  if (!info || !info.prefix || info.prefix.length < 1) {
    return '?';
  }
  // Use just the first letter of the first prefix
  const firstPrefix = info.prefix[0];
  return firstPrefix.substring(0, 1).toUpperCase();
};

// Tool settings are now project-specific, not global
// These functions only return defaults - actual settings come from project data
export const loadToolSettings = (_toolId: string, defaultColor: string, defaultSize: number): ToolSettings => {
  // Tool settings are project-specific, so we only use defaults here
  // Actual settings will be loaded from project data when a project is opened
  return {
    color: defaultColor,
    size: defaultSize,
  };
};

// Tool settings are project-specific - this is now a no-op
// Settings are persisted in the project file, not localStorage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const saveToolSettings = (_toolId: string, _color: string, _size: number): void => {
  // No-op: Tool settings are project-specific and saved in project files
  // This function is kept for compatibility but does nothing
};

// Helper functions to load/save layer-specific tool settings
// Tool settings are now project-specific, not global
export const loadToolLayerSettings = (_toolId: string, _layer: Layer, defaultColor: string, defaultSize: number): ToolSettings => {
  // Tool settings are project-specific, so we only use defaults here
  // Actual settings will be loaded from project data when a project is opened
  return {
    color: defaultColor,
    size: defaultSize,
  };
};

// Tool settings are project-specific - this is now a no-op
// Settings are persisted in the project file, not localStorage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const saveToolLayerSettings = (_toolId: string, _layer: Layer, _color: string, _size: number): void => {
  // No-op: Tool settings are project-specific and saved in project files
  // This function is kept for compatibility but does nothing
};

// Helper functions for tool registry (prepared for future use)
// These functions are part of the generalized tool registry system but not yet used
// @ts-ignore - Reserved for future use in generalized tool system
export const _getToolColor = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer): string => {
  const toolDef = registry.get(toolId);
  if (!toolDef) return '#000000';
  const layerSettings = toolDef.layerSettings.get(layer);
  return layerSettings?.color || toolDef.settings.color || '#000000';
};

// @ts-ignore - Reserved for future use
export const _getToolSize = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer): number => {
  const toolDef = registry.get(toolId);
  if (!toolDef) return 10;
  const layerSettings = toolDef.layerSettings.get(layer);
  return layerSettings?.size || toolDef.settings.size || 10;
};

// @ts-ignore - Reserved for future use in generalized tool system
export const _setToolColor = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer, color: string): Map<string, ToolDefinition> => {
  const updated = new Map(registry);
  const toolDef = updated.get(toolId);
  if (toolDef) {
    const layerSettings = new Map(toolDef.layerSettings);
    const currentLayerSettings = layerSettings.get(layer) || { color: toolDef.settings.color, size: toolDef.settings.size };
    layerSettings.set(layer, { ...currentLayerSettings, color });
    updated.set(toolId, { ...toolDef, layerSettings });
  }
  return updated;
};

// @ts-ignore - Reserved for future use
export const _setToolSize = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer, size: number): Map<string, ToolDefinition> => {
  const updated = new Map(registry);
  const toolDef = updated.get(toolId);
  if (toolDef) {
    const layerSettings = new Map(toolDef.layerSettings);
    const currentLayerSettings = layerSettings.get(layer) || { color: toolDef.settings.color, size: toolDef.settings.size };
    layerSettings.set(layer, { ...currentLayerSettings, size });
    updated.set(toolId, { ...toolDef, layerSettings });
  }
  return updated;
};

// Tool registry - centralized definition of all tools with their attributes
// Settings are loaded from localStorage with fallback to defaults
export const createToolRegistry = (): Map<string, ToolDefinition> => {
  const registry = new Map<string, ToolDefinition>();
  
  // Default layer-specific colors and sizes (from user requirements)
  const DEFAULT_PAD_COLORS = { top: '#0072B2', bottom: '#56B4E9' };
  const DEFAULT_PAD_SIZES = { top: 18, bottom: 18 };
  const DEFAULT_TEST_POINT_COLORS = { top: '#FFFF00', bottom: '#FFFF00' }; // Bright yellow
  const DEFAULT_TEST_POINT_SIZES = { top: 18, bottom: 18 };
  const DEFAULT_TRACE_COLORS = { top: '#AA4499', bottom: '#F781BF' };
  const DEFAULT_TRACE_SIZES = { top: 6, bottom: 6 };
  const DEFAULT_COMPONENT_COLORS = { top: '#6A3D9A', bottom: '#9467BD' };
  const DEFAULT_COMPONENT_SIZES = { top: 18, bottom: 18 };
  
  registry.set('select', {
    id: 'select',
    name: 'Select',
    toolType: 'select',
    icon: '⊕',
    shortcut: 'S',
    tooltip: 'Select objects or groups',
    colorReflective: false,
    settings: loadToolSettings('select', '#ff0000', 10),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('select', 'top', '#ff0000', 10)],
      ['bottom', loadToolLayerSettings('select', 'bottom', '#ff0000', 10)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('via', {
    id: 'via',
    name: 'Via',
    toolType: 'draw',
    drawingMode: 'via',
    icon: '◎',
    shortcut: 'V',
    tooltip: 'Place via connection',
    colorReflective: true,
    settings: loadToolSettings('via', DEFAULT_VIA_COLOR, VIA.DEFAULT_SIZE),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('via', 'top', DEFAULT_VIA_COLOR, VIA.DEFAULT_SIZE)],
      ['bottom', loadToolLayerSettings('via', 'bottom', DEFAULT_VIA_COLOR, VIA.DEFAULT_SIZE)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('pad', {
    id: 'pad',
    name: 'Pad',
    toolType: 'draw',
    drawingMode: 'pad',
    icon: '▢',
    shortcut: 'P',
    tooltip: 'Place pad connection',
    colorReflective: true,
    settings: loadToolSettings('pad', DEFAULT_PAD_COLOR, 18),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('pad', 'top', DEFAULT_PAD_COLORS.top, DEFAULT_PAD_SIZES.top)],
      ['bottom', loadToolLayerSettings('pad', 'bottom', DEFAULT_PAD_COLORS.bottom, DEFAULT_PAD_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('testPoint', {
    id: 'testPoint',
    name: 'Test Point',
    toolType: 'draw',
    drawingMode: 'testPoint',
    icon: '◆',
    shortcut: 'Y',
    tooltip: 'Place test point',
    colorReflective: true,
    settings: loadToolSettings('testPoint', '#FFFF00', 18), // Bright yellow default
    layerSettings: new Map([
      ['top', loadToolLayerSettings('testPoint', 'top', DEFAULT_TEST_POINT_COLORS.top, DEFAULT_TEST_POINT_SIZES.top)],
      ['bottom', loadToolLayerSettings('testPoint', 'bottom', DEFAULT_TEST_POINT_COLORS.bottom, DEFAULT_TEST_POINT_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('trace', {
    id: 'trace',
    name: 'Trace',
    toolType: 'draw',
    drawingMode: 'trace',
    icon: '╱',
    shortcut: 'T',
    tooltip: 'Draw copper traces',
    colorReflective: true,
    settings: loadToolSettings('trace', DEFAULT_TRACE_COLOR, 6),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('trace', 'top', DEFAULT_TRACE_COLORS.top, DEFAULT_TRACE_SIZES.top)],
      ['bottom', loadToolLayerSettings('trace', 'bottom', DEFAULT_TRACE_COLORS.bottom, DEFAULT_TRACE_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('component', {
    id: 'component',
    name: 'Component',
    toolType: 'component',
    icon: '▭',
    shortcut: 'C',
    tooltip: 'Place component',
    colorReflective: true,
    settings: loadToolSettings('component', DEFAULT_COMPONENT_COLOR, COMPONENT_ICON.DEFAULT_SIZE),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('component', 'top', DEFAULT_COMPONENT_COLORS.top, DEFAULT_COMPONENT_SIZES.top)],
      ['bottom', loadToolLayerSettings('component', 'bottom', DEFAULT_COMPONENT_COLORS.bottom, DEFAULT_COMPONENT_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('componentConnection', {
    id: 'componentConnection',
    name: 'Component Connections',
    toolType: 'componentConnection',
    icon: '─',
    shortcut: '',
    tooltip: 'Component connection lines',
    colorReflective: false,
    settings: loadToolSettings('componentConnection', '#E69F00', 3),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('componentConnection', 'top', '#E69F00', 3)],
      ['bottom', loadToolLayerSettings('componentConnection', 'bottom', '#E69F00', 3)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('power', {
    id: 'power',
    name: 'Power',
    toolType: 'power',
    icon: '⊕',
    shortcut: 'B',
    tooltip: 'Place power node',
    colorReflective: true,
    settings: loadToolSettings('power', DEFAULT_POWER_COLOR, 18),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('power', 'top', DEFAULT_POWER_COLOR, 18)],
      ['bottom', loadToolLayerSettings('power', 'bottom', DEFAULT_POWER_COLOR, 18)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('ground', {
    id: 'ground',
    name: 'Ground',
    toolType: 'ground',
    icon: '⏚',
    shortcut: 'G',
    tooltip: 'Place ground symbol',
    colorReflective: true,
    settings: loadToolSettings('ground', DEFAULT_GROUND_COLOR, 18),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('ground', 'top', DEFAULT_GROUND_COLOR, 18)],
      ['bottom', loadToolLayerSettings('ground', 'bottom', DEFAULT_GROUND_COLOR, 18)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('erase', {
    id: 'erase',
    name: 'Erase',
    toolType: 'erase',
    icon: '▭',
    shortcut: 'E',
    tooltip: 'Erase objects',
    colorReflective: false,
    settings: loadToolSettings('erase', '#f5a3b3', 18),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('erase', 'top', '#f5a3b3', 18)],
      ['bottom', loadToolLayerSettings('erase', 'bottom', '#f5a3b3', 18)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('pan', {
    id: 'pan',
    name: 'Move',
    toolType: 'pan',
    icon: '✋',
    shortcut: 'H',
    tooltip: 'Pan the view',
    colorReflective: false,
    settings: loadToolSettings('pan', '#ff0000', 10),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('pan', 'top', '#ff0000', 10)],
      ['bottom', loadToolLayerSettings('pan', 'bottom', '#ff0000', 10)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('magnify', {
    id: 'magnify',
    name: 'Zoom',
    toolType: 'magnify',
    icon: '🔍+',
    shortcut: 'M',
    tooltip: 'Magnify',
    colorReflective: false,
    settings: loadToolSettings('magnify', '#ff0000', 10),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('magnify', 'top', '#ff0000', 10)],
      ['bottom', loadToolLayerSettings('magnify', 'bottom', '#ff0000', 10)],
    ] as [Layer, ToolSettings][]),
  });
  
  return registry;
};

