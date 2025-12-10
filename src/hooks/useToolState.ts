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
 * Centralized Tool State Management
 * 
 * Monitors toolbar user actions and maintains the current active tool instance
 * as the single source of truth for tool attributes.
 * 
 * Step 1: Which tool was selected by the user?
 * Step 2: Which layer was selected? (if applicable)
 * Based on steps 1 and 2, the specific tool instance is known and its attributes
 * are used to provide, maintain, and update attribute values.
 */

import { useState, useEffect, useCallback } from 'react';
import { toolInstanceManager, type ToolInstanceId } from '../utils/toolInstances';
import type { Tool } from '../types';

export interface ToolState {
  /** Current active tool */
  currentTool: Tool;
  /** Current drawing mode (if applicable) */
  drawingMode?: 'trace' | 'via' | 'pad' | 'testPoint';
  /** Current layer selection (if applicable) */
  layer?: 'top' | 'bottom';
  /** Current active tool instance ID (derived from tool + layer) */
  toolInstanceId: ToolInstanceId | null;
  /** Current tool instance color */
  color: string;
  /** Current tool instance size */
  size: number;
}

export interface UseToolStateProps {
  /** Current tool from toolbar */
  currentTool: Tool;
  /** Current drawing mode */
  drawingMode?: 'trace' | 'via' | 'pad' | 'testPoint';
  /** Trace tool layer */
  traceToolLayer?: 'top' | 'bottom';
  /** Pad tool layer */
  padToolLayer?: 'top' | 'bottom';
  /** Test Point tool layer */
  testPointToolLayer?: 'top' | 'bottom';
  /** Component tool layer */
  componentToolLayer?: 'top' | 'bottom';
}

/**
 * Centralized tool state management hook
 * Monitors toolbar actions and maintains active tool instance as single source of truth
 */
export function useToolState(props: UseToolStateProps) {
  const {
    currentTool,
    drawingMode,
    traceToolLayer,
    padToolLayer,
    testPointToolLayer,
    componentToolLayer,
  } = props;

  // State to trigger re-renders when tool instances change
  // Note: Only setToolInstanceUpdateTrigger is used, the value itself is unused
  // @ts-ignore - toolInstanceUpdateTrigger is intentionally unused (only setter is used)
  const [toolInstanceUpdateTrigger, setToolInstanceUpdateTrigger] = useState(0);

  // Determine current tool instance ID based on tool and layer selection
  // Step 1: Which tool was selected? (currentTool, drawingMode)
  // Step 2: Which layer was selected? (padToolLayer, testPointToolLayer, etc.)
  // Based on steps 1 and 2, the specific tool instance is known
  const getCurrentToolInstanceId = useCallback((): ToolInstanceId | null => {
    // Step 1: Determine which tool was selected
    if (currentTool === 'draw' && drawingMode === 'via') {
      // Via tool has no layers - return immediately
      return 'via';
    } else if (currentTool === 'draw' && drawingMode === 'pad') {
      // Step 2: Determine which layer was selected (default to 'top' if not yet selected)
      return padToolLayer === 'bottom' ? 'padBottom' : 'padTop';
    } else if (currentTool === 'draw' && drawingMode === 'testPoint') {
      // Step 2: Determine which layer was selected (default to 'top' if not yet selected)
      return testPointToolLayer === 'bottom' ? 'testPointBottom' : 'testPointTop';
    } else if (currentTool === 'draw' && drawingMode === 'trace') {
      // Step 2: Determine which layer was selected (default to 'top' if not yet selected)
      return traceToolLayer === 'bottom' ? 'traceBottom' : 'traceTop';
    } else if (currentTool === 'component') {
      // Step 2: Determine which layer was selected (default to 'top' if not yet selected)
      return componentToolLayer === 'bottom' ? 'componentBottom' : 'componentTop';
    } else if (currentTool === 'power') {
      // Power tool has no layers - return immediately
      return 'power';
    } else if (currentTool === 'ground') {
      // Ground tool has no layers - return immediately
      return 'ground';
    }
    // No tool selected (e.g., select tool)
    return null;
  }, [currentTool, drawingMode, padToolLayer, testPointToolLayer, traceToolLayer, componentToolLayer]);

  // Get current tool state
  const getToolState = useCallback((): ToolState => {
    const toolInstanceId = getCurrentToolInstanceId();
    
    if (toolInstanceId) {
      const instance = toolInstanceManager.get(toolInstanceId);
      return {
        currentTool,
        drawingMode,
        layer: 
          currentTool === 'draw' && drawingMode === 'pad' ? (padToolLayer || 'top') :
          currentTool === 'draw' && drawingMode === 'testPoint' ? (testPointToolLayer || 'top') :
          currentTool === 'draw' && drawingMode === 'trace' ? (traceToolLayer || 'top') :
          currentTool === 'component' ? (componentToolLayer || 'top') :
          undefined,
        toolInstanceId,
        color: instance.color,
        size: instance.size,
      };
    }

    // No active tool instance (e.g., select tool)
    return {
      currentTool,
      drawingMode,
      layer: undefined,
      toolInstanceId: null,
      color: '#000000', // Default fallback
      size: 10, // Default fallback
    };
  }, [currentTool, drawingMode, padToolLayer, testPointToolLayer, traceToolLayer, componentToolLayer, getCurrentToolInstanceId]);

  // Subscribe to tool instance changes
  useEffect(() => {
    const toolInstanceId = getCurrentToolInstanceId();
    if (!toolInstanceId) return;

    const unsubscribe = toolInstanceManager.subscribe(toolInstanceId, () => {
      setToolInstanceUpdateTrigger(prev => prev + 1);
    });

    return unsubscribe;
  }, [getCurrentToolInstanceId]);

  // Get current tool state (reactive to changes)
  const toolState = getToolState();

  // Update tool instance color
  const setColor = useCallback((color: string) => {
    const toolInstanceId = getCurrentToolInstanceId();
    if (toolInstanceId) {
      toolInstanceManager.setColor(toolInstanceId, color);
    }
  }, [getCurrentToolInstanceId]);

  // Update tool instance size
  const setSize = useCallback((size: number) => {
    const toolInstanceId = getCurrentToolInstanceId();
    if (toolInstanceId) {
      toolInstanceManager.setSize(toolInstanceId, size);
    }
  }, [getCurrentToolInstanceId]);

  return {
    toolState,
    setColor,
    setSize,
    getCurrentToolInstanceId,
  };
}

