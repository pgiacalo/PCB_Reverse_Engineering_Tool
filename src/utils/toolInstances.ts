/**
 * Tool Instance System
 * 
 * Singleton instances for each drawing tool, providing a single source of truth
 * for tool attributes (color, size, etc.) with no sharing between tools.
 * 
 * Copyright 2025
 * Licensed under the Apache License, Version 2.0
 */

export type ToolInstanceId = 
  | 'via'
  | 'padTop'
  | 'padBottom'
  | 'testPointTop'
  | 'testPointBottom'
  | 'traceTop'
  | 'traceBottom'
  | 'componentTop'
  | 'componentBottom'
  | 'power'
  | 'ground';

export interface ToolInstance {
  id: ToolInstanceId;
  name: string;
  color: string;
  size: number;
  // Additional attributes can be added here as needed
}

/**
 * Default values for each tool instance
 */
const DEFAULT_VALUES: Record<ToolInstanceId, { color: string; size: number }> = {
  via: { color: '#ff0000', size: 18 },
  padTop: { color: '#0072B2', size: 18 },
  padBottom: { color: '#56B4E9', size: 18 },
  testPointTop: { color: '#FFFF00', size: 18 },
  testPointBottom: { color: '#FFFF00', size: 18 },
  traceTop: { color: '#AA4499', size: 6 },
  traceBottom: { color: '#F781BF', size: 6 },
  componentTop: { color: '#6A3D9A', size: 18 },
  componentBottom: { color: '#9467BD', size: 18 },
  power: { color: '#ff0000', size: 18 },
  ground: { color: '#000000', size: 18 },
};

/**
 * Tool instance names
 */
const TOOL_NAMES: Record<ToolInstanceId, string> = {
  via: 'Via',
  padTop: 'Pad (Top)',
  padBottom: 'Pad (Bottom)',
  testPointTop: 'Test Point (Top)',
  testPointBottom: 'Test Point (Bottom)',
  traceTop: 'Trace (Top)',
  traceBottom: 'Trace (Bottom)',
  componentTop: 'Component (Top)',
  componentBottom: 'Component (Bottom)',
  power: 'Power',
  ground: 'Ground',
};

/**
 * Singleton tool instances - single source of truth for each tool
 */
class ToolInstanceManager {
  private instances: Map<ToolInstanceId, ToolInstance> = new Map();
  private listeners: Map<ToolInstanceId, Set<() => void>> = new Map();

  /**
   * Initialize all tool instances with default values
   */
  initialize(): void {
    for (const id of Object.keys(DEFAULT_VALUES) as ToolInstanceId[]) {
      const defaults = DEFAULT_VALUES[id];
      this.instances.set(id, {
        id,
        name: TOOL_NAMES[id],
        color: defaults.color,
        size: defaults.size,
      });
      this.listeners.set(id, new Set());
    }
  }

  /**
   * Initialize tool instances from persisted project data
   */
  initializeFromProject(projectData: any): void {
    this.initialize(); // Start with defaults
    
    // Load from project data if available
    if (projectData?.toolInstances) {
      for (const [id, instance] of Object.entries(projectData.toolInstances) as [ToolInstanceId, ToolInstance][]) {
        if (this.instances.has(id)) {
          this.instances.set(id, instance);
        }
      }
    }
  }

  /**
   * Get a tool instance
   * Note: We don't log attribute reads here because React re-renders cause many
   * property accesses just for display purposes, which would create excessive logging.
   * Attribute reads are logged explicitly in key operational contexts (e.g., drawing operations).
   */
  get(id: ToolInstanceId): ToolInstance {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error(`Tool instance ${id} not found`);
    }
    return instance;
  }
  
  /**
   * Get tool instance color with logging (for explicit operational use)
   */
  getColor(id: ToolInstanceId): string {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error(`Tool instance ${id} not found`);
    }
    const toolName = TOOL_NAMES[id];
    console.log(`${toolName}, returning color value=${instance.color}`);
    return instance.color;
  }
  
  /**
   * Get tool instance size with logging (for explicit operational use)
   */
  getSize(id: ToolInstanceId): number {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error(`Tool instance ${id} not found`);
    }
    const toolName = TOOL_NAMES[id];
    console.log(`${toolName}, returning size value=${instance.size}`);
    return instance.size;
  }

  /**
   * Update tool instance color
   */
  setColor(id: ToolInstanceId, color: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      const toolName = TOOL_NAMES[id];
      console.log(`${toolName}, setting color value=${color}`);
      instance.color = color;
      this.notifyListeners(id);
    }
  }

  /**
   * Update tool instance size
   */
  setSize(id: ToolInstanceId, size: number): void {
    const instance = this.instances.get(id);
    if (instance) {
      const toolName = TOOL_NAMES[id];
      console.log(`${toolName}, setting size value=${size}`);
      instance.size = size;
      this.notifyListeners(id);
    }
  }

  /**
   * Get all tool instances for project persistence
   */
  getAll(): Record<ToolInstanceId, ToolInstance> {
    const result: Partial<Record<ToolInstanceId, ToolInstance>> = {};
    for (const [id, instance] of this.instances.entries()) {
      result[id] = instance;
    }
    return result as Record<ToolInstanceId, ToolInstance>;
  }

  /**
   * Subscribe to changes for a specific tool instance
   */
  subscribe(id: ToolInstanceId, callback: () => void): () => void {
    const listeners = this.listeners.get(id);
    if (listeners) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    }
    return () => {};
  }

  /**
   * Notify listeners of changes
   */
  private notifyListeners(id: ToolInstanceId): void {
    const listeners = this.listeners.get(id);
    if (listeners) {
      listeners.forEach(callback => callback());
    }
  }
}

// Singleton instance
export const toolInstanceManager = new ToolInstanceManager();

// Initialize tool instances immediately at module load (before any component renders)
toolInstanceManager.initialize();

/**
 * Helper function to get tool instance ID from tool and layer
 */
export function getToolInstanceId(
  tool: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'power' | 'ground',
  layer?: 'top' | 'bottom'
): ToolInstanceId {
  switch (tool) {
    case 'via':
      return 'via';
    case 'pad':
      return layer === 'bottom' ? 'padBottom' : 'padTop';
    case 'testPoint':
      return layer === 'bottom' ? 'testPointBottom' : 'testPointTop';
    case 'trace':
      return layer === 'bottom' ? 'traceBottom' : 'traceTop';
    case 'component':
      return layer === 'bottom' ? 'componentBottom' : 'componentTop';
    case 'power':
      return 'power';
    case 'ground':
      return 'ground';
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

