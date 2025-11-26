// ============================================================================
// Centralized PCB Connectivity Manager
// ============================================================================
// This manager maintains a read-only connectivity graph that syncs from
// existing state. It provides query methods for connectivity analysis
// and schematic generation without replacing existing state management.

import type { 
  PCBComponent, 
  DrawingStroke 
} from '../types';
import type { 
  PowerSymbol, 
  GroundSymbol, 
  PowerBus 
} from '../hooks/usePowerGround';
import type { NetlistNode } from './netlist';
import { buildConnectivityGraph, groupNodesIntoNets } from './netlist';

/**
 * Centralized PCB Connectivity Manager
 * Maintains a read-only connectivity graph synchronized from existing state.
 * Provides query methods for connectivity analysis and schematic generation.
 */
export class PCBConnectivityManager {
  // Core connectivity graph
  private nodes: Map<number, NetlistNode> = new Map();
  private connections: Array<[number, number]> = [];
  private netGroups: Map<number, NetlistNode[]> = new Map();
  
  // Ground and power node tracking
  private groundNodeIds: Set<number> = new Set();
  private powerNodeIds: Map<number, { voltage: string; powerBusId: string }> = new Map();
  
  // Track original node types (before ground/power association)
  private originalNodeTypes: Map<number, 'via' | 'pad' | 'trace_point' | 'component_pin'> = new Map();
  
  // Element tracking (for fast lookups)
  private traceMap: Map<string, DrawingStroke> = new Map();
  private componentMap: Map<string, PCBComponent> = new Map();
  private powerSymbolMap: Map<string, PowerSymbol> = new Map();
  private groundSymbolMap: Map<string, GroundSymbol> = new Map();
  private powerBusMap: Map<string, PowerBus> = new Map();
  
  // Indices for fast queries
  private nodeToTraces: Map<number, Set<string>> = new Map();
  private nodeToComponents: Map<number, Set<string>> = new Map();
  private componentToNodes: Map<string, Map<number, number>> = new Map(); // compId -> pinIndex -> nodeId
  
  // Sync state
  private lastSyncHash: string = '';
  private isDirty: boolean = true;

  /**
   * Sync connectivity graph from current state
   * Call this whenever the source data changes
   */
  syncFromState(
    drawingStrokes: DrawingStroke[],
    components: PCBComponent[],
    powerSymbols: PowerSymbol[],
    groundSymbols: GroundSymbol[],
    powerBuses: PowerBus[]
  ): void {
    // Build hash to detect if state actually changed
    const stateHash = this.buildStateHash(
      drawingStrokes,
      components,
      powerSymbols,
      groundSymbols,
      powerBuses
    );
    
    if (stateHash === this.lastSyncHash && !this.isDirty) {
      return; // No changes, skip rebuild
    }
    
    this.lastSyncHash = stateHash;
    this.isDirty = false;
    
    // Clear previous state
    this.nodes.clear();
    this.connections = [];
    this.netGroups.clear();
    this.groundNodeIds.clear();
    this.powerNodeIds.clear();
    this.originalNodeTypes.clear();
    this.traceMap.clear();
    this.componentMap.clear();
    this.powerSymbolMap.clear();
    this.groundSymbolMap.clear();
    this.powerBusMap.clear();
    this.nodeToTraces.clear();
    this.nodeToComponents.clear();
    this.componentToNodes.clear();
    
    // Build element maps
    for (const stroke of drawingStrokes) {
      if (stroke.type === 'trace') {
        this.traceMap.set(stroke.id, stroke);
      }
    }
    
    for (const comp of components) {
      this.componentMap.set(comp.id, comp);
    }
    
    for (const power of powerSymbols) {
      this.powerSymbolMap.set(power.id, power);
    }
    
    for (const ground of groundSymbols) {
      this.groundSymbolMap.set(ground.id, ground);
    }
    
    for (const bus of powerBuses) {
      this.powerBusMap.set(bus.id, bus);
    }
    
    // Build connectivity graph
    this.nodes = buildConnectivityGraph(
      drawingStrokes,
      components,
      powerSymbols,
      groundSymbols,
      powerBuses
    );
    
    // Store original node types (before ground/power association)
    this.storeOriginalNodeTypes(drawingStrokes, components);
    
    // Build connections from traces
    this.buildConnections(drawingStrokes);
    
    // Track ground and power node associations
    this.updateGroundPowerAssociations(powerSymbols, groundSymbols, powerBuses);
    
    // Group nodes into nets
    this.netGroups = groupNodesIntoNets(this.nodes, this.connections);
    
    // Build indices for fast queries
    this.buildIndices();
  }

  /**
   * Build connections from traces
   */
  private buildConnections(drawingStrokes: DrawingStroke[]): void {
    this.connections = [];
    
    for (const stroke of drawingStrokes) {
      if (stroke.type === 'trace' && stroke.points.length >= 2) {
        // Extract all points with Node IDs from this trace
        const nodesInTrace: Array<{ pointIndex: number; nodeId: number }> = [];
        for (let i = 0; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          if (point && point.id !== undefined && point.id !== null) {
            nodesInTrace.push({ pointIndex: i, nodeId: point.id });
          }
        }
        
        // Connect all nodes in the trace (they're all connected through the trace path)
        for (let i = 0; i < nodesInTrace.length; i++) {
          for (let j = i + 1; j < nodesInTrace.length; j++) {
            const nodeId1 = nodesInTrace[i].nodeId;
            const nodeId2 = nodesInTrace[j].nodeId;
            
            if (this.nodes.has(nodeId1) && this.nodes.has(nodeId2)) {
              this.connections.push([nodeId1, nodeId2]);
            }
          }
        }
        
        // Also connect consecutive points in the trace
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const point1 = stroke.points[i];
          const point2 = stroke.points[i + 1];
          
          if (point1 && point2 && 
              point1.id !== undefined && point1.id !== null &&
              point2.id !== undefined && point2.id !== null) {
            const nodeId1 = point1.id;
            const nodeId2 = point2.id;
            
            if (this.nodes.has(nodeId1) && this.nodes.has(nodeId2) && nodeId1 !== nodeId2) {
              this.connections.push([nodeId1, nodeId2]);
            }
          }
        }
      }
    }
  }

  /**
   * Store original node types before ground/power association
   */
  private storeOriginalNodeTypes(
    drawingStrokes: DrawingStroke[],
    components: PCBComponent[]
  ): void {
    this.originalNodeTypes.clear();
    
    // Store types from drawing strokes (vias, pads, trace points)
    for (const stroke of drawingStrokes) {
      if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
        const point = stroke.points[0];
        if (point.id !== undefined && point.id !== null) {
          this.originalNodeTypes.set(point.id, stroke.type);
        }
      } else if (stroke.type === 'trace') {
        for (const point of stroke.points) {
          if (point.id !== undefined && point.id !== null) {
            // Only store if not already stored (vias/pads take precedence)
            if (!this.originalNodeTypes.has(point.id)) {
              this.originalNodeTypes.set(point.id, 'trace_point');
            }
          }
        }
      }
    }
    
    // Store types from component pins
    for (const comp of components) {
      const pinConnections = comp.pinConnections || [];
      for (let pinIndex = 0; pinIndex < pinConnections.length; pinIndex++) {
        const nodeIdStr = pinConnections[pinIndex];
        if (nodeIdStr && nodeIdStr.trim() !== '') {
          const nodeId = parseInt(nodeIdStr.trim(), 10);
          if (!isNaN(nodeId) && nodeId > 0) {
            // Only store if not already stored (vias/pads/traces take precedence)
            if (!this.originalNodeTypes.has(nodeId)) {
              this.originalNodeTypes.set(nodeId, 'component_pin');
            }
          }
        }
      }
    }
  }

  /**
   * Update ground and power node associations
   * Associates nodes with ground/power when symbols share the same pointId
   * Disassociates when symbols are removed
   */
  private updateGroundPowerAssociations(
    powerSymbols: PowerSymbol[],
    groundSymbols: GroundSymbol[],
    powerBuses: PowerBus[]
  ): void {
    // Clear previous associations
    this.groundNodeIds.clear();
    this.powerNodeIds.clear();
    
    // Associate ground nodes
    for (const ground of groundSymbols) {
      if (ground.pointId !== undefined && ground.pointId !== null) {
        this.groundNodeIds.add(ground.pointId);
        
        // Update node type if it exists
        const node = this.nodes.get(ground.pointId);
        if (node) {
          node.type = 'ground';
        }
      }
    }
    
    // Associate power nodes
    for (const power of powerSymbols) {
      if (power.pointId !== undefined && power.pointId !== null) {
        const bus = powerBuses.find(b => b.id === power.powerBusId);
        const voltage = bus?.voltage || power.type || 'UNKNOWN';
        
        this.powerNodeIds.set(power.pointId, {
          voltage,
          powerBusId: power.powerBusId
        });
        
        // Update node type if it exists
        const node = this.nodes.get(power.pointId);
        if (node) {
          node.type = 'power';
          node.voltage = voltage;
          node.powerBusId = power.powerBusId;
        }
      }
    }
    
    // Disassociate nodes that no longer have ground/power symbols
    // (This happens when symbols are deleted)
    for (const [nodeId, node] of this.nodes) {
      // If node was previously ground but no longer has a ground symbol
      if (node.type === 'ground' && !this.groundNodeIds.has(nodeId)) {
        // Revert to original type
        const originalType = this.getOriginalNodeType(nodeId);
        node.type = originalType;
      }
      
      // If node was previously power but no longer has a power symbol
      if (node.type === 'power' && !this.powerNodeIds.has(nodeId)) {
        // Revert to original type
        const originalType = this.getOriginalNodeType(nodeId);
        node.type = originalType;
        delete node.voltage;
        delete node.powerBusId;
      }
    }
  }

  /**
   * Get original node type (before ground/power association)
   */
  private getOriginalNodeType(nodeId: number): 'via' | 'pad' | 'trace_point' | 'component_pin' {
    // First check if we stored the original type
    const storedType = this.originalNodeTypes.get(nodeId);
    if (storedType) {
      return storedType;
    }
    
    // Fallback: check current node type (if it's not ground/power)
    const node = this.nodes.get(nodeId);
    if (node && node.type !== 'ground' && node.type !== 'power') {
      return node.type;
    }
    
    // Default to trace_point
    return 'trace_point';
  }

  /**
   * Build indices for fast queries
   */
  private buildIndices(): void {
    this.nodeToTraces.clear();
    this.nodeToComponents.clear();
    this.componentToNodes.clear();
    
    // Build node -> traces index
    for (const [traceId, trace] of this.traceMap) {
      for (const point of trace.points) {
        if (point.id !== undefined && point.id !== null) {
          if (!this.nodeToTraces.has(point.id)) {
            this.nodeToTraces.set(point.id, new Set());
          }
          this.nodeToTraces.get(point.id)!.add(traceId);
        }
      }
    }
    
    // Build node -> components and component -> nodes indices
    for (const [compId, comp] of this.componentMap) {
      const pinConnections = comp.pinConnections || [];
      const nodeMap = new Map<number, number>(); // pinIndex -> nodeId
      
      for (let pinIndex = 0; pinIndex < pinConnections.length; pinIndex++) {
        const nodeIdStr = pinConnections[pinIndex];
        if (nodeIdStr && nodeIdStr.trim() !== '') {
          const nodeId = parseInt(nodeIdStr.trim(), 10);
          if (!isNaN(nodeId) && nodeId > 0) {
            nodeMap.set(pinIndex, nodeId);
            
            if (!this.nodeToComponents.has(nodeId)) {
              this.nodeToComponents.set(nodeId, new Set());
            }
            this.nodeToComponents.get(nodeId)!.add(compId);
          }
        }
      }
      
      if (nodeMap.size > 0) {
        this.componentToNodes.set(compId, nodeMap);
      }
    }
  }

  /**
   * Build state hash for change detection
   */
  private buildStateHash(
    drawingStrokes: DrawingStroke[],
    components: PCBComponent[],
    powerSymbols: PowerSymbol[],
    groundSymbols: GroundSymbol[],
    powerBuses: PowerBus[]
  ): string {
    // Simple hash based on counts and IDs
    // In production, you might want a more sophisticated hash
    const strokeIds = drawingStrokes.map(s => s.id).sort().join(',');
    const compIds = components.map(c => c.id).sort().join(',');
    const powerIds = powerSymbols.map(p => p.id).sort().join(',');
    const groundIds = groundSymbols.map(g => g.id).sort().join(',');
    const busIds = powerBuses.map(b => b.id).sort().join(',');
    
    return `${drawingStrokes.length}:${strokeIds}|${components.length}:${compIds}|${powerSymbols.length}:${powerIds}|${groundSymbols.length}:${groundIds}|${powerBuses.length}:${busIds}`;
  }

  /**
   * Mark manager as dirty (force rebuild on next sync)
   */
  markDirty(): void {
    this.isDirty = true;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get all nodes
   */
  getAllNodes(): Map<number, NetlistNode> {
    return new Map(this.nodes);
  }

  /**
   * Get all connections
   */
  getAllConnections(): Array<[number, number]> {
    return [...this.connections];
  }

  /**
   * Get all net groups
   */
  getAllNetGroups(): Map<number, NetlistNode[]> {
    return new Map(this.netGroups);
  }

  /**
   * Get nodes connected to a specific node (via traces)
   */
  getNodesConnectedTo(nodeId: number): NetlistNode[] {
    const connectedNodeIds = new Set<number>();
    const visited = new Set<number>();
    
    const dfs = (currentNodeId: number) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      if (currentNodeId !== nodeId) {
        const node = this.nodes.get(currentNodeId);
        if (node && node.type !== 'trace_point') {
          connectedNodeIds.add(currentNodeId);
        }
      }
      
      // Follow connections
      for (const [nodeId1, nodeId2] of this.connections) {
        if (nodeId1 === currentNodeId) {
          dfs(nodeId2);
        } else if (nodeId2 === currentNodeId) {
          dfs(nodeId1);
        }
      }
    };
    
    dfs(nodeId);
    
    return Array.from(connectedNodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is NetlistNode => node !== undefined);
  }

  /**
   * Get component pins connected to a node
   */
  getComponentPinsOnNode(nodeId: number): Array<{ compId: string; pin: number; designator?: string }> {
    const componentIds = this.nodeToComponents.get(nodeId);
    if (!componentIds || componentIds.size === 0) {
      return [];
    }
    
    const pins: Array<{ compId: string; pin: number; designator?: string }> = [];
    
    for (const compId of componentIds) {
      const comp = this.componentMap.get(compId);
      if (!comp) continue;
      
      const nodeMap = this.componentToNodes.get(compId);
      if (!nodeMap) continue;
      
      for (const [pinIndex, connectedNodeId] of nodeMap) {
        if (connectedNodeId === nodeId) {
          const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
          pins.push({
            compId,
            pin: pinIndex + 1, // 1-based for display
            designator
          });
        }
      }
    }
    
    return pins;
  }

  /**
   * Get net for a node
   */
  getNetForNode(nodeId: number): NetlistNode[] {
    for (const [, netNodes] of this.netGroups) {
      if (netNodes.some(n => n.id === nodeId)) {
        return netNodes;
      }
    }
    
    // Node not in any net (isolated)
    const node = this.nodes.get(nodeId);
    return node ? [node] : [];
  }

  /**
   * Check if a node is associated with ground
   */
  isGroundNode(nodeId: number): boolean {
    return this.groundNodeIds.has(nodeId);
  }

  /**
   * Check if a node is associated with power
   */
  isPowerNode(nodeId: number): boolean {
    return this.powerNodeIds.has(nodeId);
  }

  /**
   * Get power information for a node
   */
  getPowerInfo(nodeId: number): { voltage: string; powerBusId: string } | null {
    return this.powerNodeIds.get(nodeId) || null;
  }

  /**
   * Get all ground node IDs
   */
  getGroundNodeIds(): Set<number> {
    return new Set(this.groundNodeIds);
  }

  /**
   * Get all power node IDs
   */
  getPowerNodeIds(): Set<number> {
    return new Set(this.powerNodeIds.keys());
  }

  /**
   * Get traces connected to a node
   */
  getTracesOnNode(nodeId: number): DrawingStroke[] {
    const traceIds = this.nodeToTraces.get(nodeId);
    if (!traceIds) return [];
    
    return Array.from(traceIds)
      .map(id => this.traceMap.get(id))
      .filter((trace): trace is DrawingStroke => trace !== undefined);
  }

  /**
   * Get components connected to a node
   */
  getComponentsOnNode(nodeId: number): PCBComponent[] {
    const componentIds = this.nodeToComponents.get(nodeId);
    if (!componentIds) return [];
    
    return Array.from(componentIds)
      .map(id => this.componentMap.get(id))
      .filter((comp): comp is PCBComponent => comp !== undefined);
  }
}

