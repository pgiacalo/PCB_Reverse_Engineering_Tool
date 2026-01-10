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

// ============================================================================
// Netlist Generation Utilities
// ============================================================================

import type { PCBComponent, DrawingStroke, GroundSymbol } from '../types';

// PowerSymbol interface (matches App.tsx definition)
interface PowerSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  powerBusId: string;
  layer: 'top' | 'bottom';
  type?: string;
  pointId?: number;
}

// PowerBus interface (matches App.tsx definition)
interface PowerBus {
  id: string;
  name: string;
  voltage: string;
  color: string;
}

// GroundBus interface (matches usePowerGround.ts definition)
interface GroundBus {
  id: string;
  name: string;
  color: string;
}

/**
 * Represents a node in the connectivity graph
 */
export interface NetlistNode {
  id: number; // Point ID
  type: 'via' | 'pad' | 'power' | 'ground' | 'component_pin' | 'trace_point';
  x: number;
  y: number;
  
  // For component pins
  componentId?: string;
  pinIndex?: number; // 0-based
  
  // For power nodes
  voltage?: string; // e.g., "+5V", "+3.3V"
  powerBusId?: string;
  
  // For ground nodes
  groundBusId?: string;
}

/**
 * Represents a net (collection of connected nodes)
 */
export interface Net {
  id: string;
  name: string;
  nodes: NetlistNode[];
  netCode: number;
}

/**
 * Union-Find data structure for grouping connected nodes
 */
class UnionFind {
  private parent: Map<number, number> = new Map();
  private rank: Map<number, number> = new Map();

  find(x: number): number {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
      return x;
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<number, number[]> {
    const groups = new Map<number, number[]>();
    for (const x of this.parent.keys()) {
      const root = this.find(x);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(x);
    }
    
    return groups;
  }
}

/**
 * Calculate component pin position based on component center and pin index
 * Pins are arranged in a rectangular pattern: left side (1 to pinCount/2), right side (rest)
 */
// @ts-ignore - Reserved for future use
function _calculateComponentPinPosition(
  comp: PCBComponent,
  pinIndex: number
): { x: number; y: number } {
  const pinCount = comp.pinCount;
  const size = comp.size || 24;
  const chipWidth = size * 0.8;
  const chipHeight = size * 0.6;
  const pinLength = size * 0.15;
  const pinSpacing = chipHeight / 4;
  
  const pinsPerSide = Math.ceil(pinCount / 2);
  const isLeftSide = pinIndex < pinsPerSide;
  
  let pinX: number;
  let pinY: number;
  
  if (isLeftSide) {
    // Left side pins
    pinX = comp.x - chipWidth / 2 - pinLength;
    pinY = comp.y - chipHeight / 2 + chipHeight / 4 + (pinIndex * pinSpacing);
  } else {
    // Right side pins
    const rightPinIndex = pinIndex - pinsPerSide;
    pinX = comp.x + chipWidth / 2 + pinLength;
    pinY = comp.y - chipHeight / 2 + chipHeight / 4 + (rightPinIndex * pinSpacing);
  }
  
  return { x: Math.round(pinX), y: Math.round(pinY) };
}

/**
 * Build connectivity graph using COORDINATE-BASED matching
 * Groups all points with the same x,y coordinates into the same node
 * 
 * EFFICIENCY: Uses hash map approach (O(n) time, O(n) space)
 * - Single pass through all objects
 * - Tuple (x, y) as string key provides O(1) lookup
 * - Immediately groups duplicates together
 */
export function buildConnectivityGraphCoordinateBased(
  drawingStrokes: DrawingStroke[],
  components: PCBComponent[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): Map<string, NetlistNode> {
  // Hash map: coordinate key "x,y" -> node
  // This efficiently groups all objects with duplicate coordinates
  const coordinateToNode = new Map<string, NetlistNode>();
  // Map: original point ID -> coordinate key (for tracking)
  const pointIdToCoord = new Map<number, string>();
  let nodeIdCounter = 1;
  
  // Coordinate precision for matching floating point coordinates
  // Using 6 decimal places provides sub-micron precision for PCB coordinates
  // This ensures exact matches for floating point coordinates while avoiding
  // floating point arithmetic precision issues
  const COORD_PRECISION = 6;
  
  // Helper to create coordinate key from x,y with precise floating point matching
  // Uses fixed precision to ensure exact matches for floating point coordinates
  const createCoordKey = (x: number, y: number): string => {
    // Round to fixed precision to handle floating point precision issues
    // while maintaining exact matches for coordinates that should be the same
    const roundedX = Math.round(x * Math.pow(10, COORD_PRECISION)) / Math.pow(10, COORD_PRECISION);
    const roundedY = Math.round(y * Math.pow(10, COORD_PRECISION)) / Math.pow(10, COORD_PRECISION);
    return `${roundedX},${roundedY}`;
  };
  
  // Helper to get or create node at coordinates (O(1) lookup via hash map)
  const getOrCreateNode = (x: number, y: number, type: NetlistNode['type'], 
                           extraData?: Partial<NetlistNode>): NetlistNode => {
    const coordKey = createCoordKey(x, y);
    
    // O(1) hash map lookup - if coordinate already exists, reuse node
    if (coordinateToNode.has(coordKey)) {
      const existing = coordinateToNode.get(coordKey)!;
      // Merge extra data if provided
      if (extraData) {
        // CRITICAL: Preserve component pin information (componentId, pinIndex) when merging
        // This ensures component pins are properly identified even when merged with vias/pads/power/ground
        // Component pins should always preserve their componentId and pinIndex
        if (extraData.componentId && extraData.pinIndex !== undefined) {
          existing.componentId = extraData.componentId;
          existing.pinIndex = extraData.pinIndex;
        }
        // CRITICAL: Preserve power/ground information when merging with component pins
        // This ensures power/ground nodes retain their voltage/bus info when component pins are added
        if (extraData.voltage !== undefined) {
          existing.voltage = extraData.voltage;
        }
        if (extraData.powerBusId !== undefined) {
          existing.powerBusId = extraData.powerBusId;
        }
        if (extraData.groundBusId !== undefined) {
          existing.groundBusId = extraData.groundBusId;
        }
        // Merge other properties (but don't overwrite component pin info if it already exists)
        for (const key in extraData) {
          if (key !== 'componentId' && key !== 'pinIndex' && key !== 'voltage' && key !== 'powerBusId' && key !== 'groundBusId') {
            (existing as any)[key] = (extraData as any)[key];
          }
        }
        // Preserve component_pin type if it exists, but also preserve power/ground type
        if (extraData.type === 'component_pin' || existing.type === 'component_pin') {
          // If we have both component pin AND power/ground, keep component_pin type but preserve power/ground properties
          existing.type = 'component_pin';
        } else if (extraData.type && !existing.type) {
          existing.type = extraData.type;
        }
      }
      return existing;
    }
    
    // Create new node for this coordinate
    // Store coordinates with full precision (not rounded) for accurate representation
    const node: NetlistNode = {
      id: nodeIdCounter++,
      type,
      x: x,  // Store original coordinate (not rounded)
      y: y,  // Store original coordinate (not rounded)
      ...extraData,
    };
    
    coordinateToNode.set(coordKey, node);
    return node;
  };
  
  // 1. Add all via points (single pass, O(n))
  let viaCount = 0;
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'via' && stroke.points.length > 0) {
      const point = stroke.points[0];
      getOrCreateNode(point.x, point.y, 'via');
      const coordKey = createCoordKey(point.x, point.y);
      if (point.id !== undefined) {
      pointIdToCoord.set(point.id, coordKey);
      }
      viaCount++;
    }
  }
  console.log(`[Connectivity] Added ${viaCount} vias to coordinate graph`);
  
  // 2. Add all trace points (single pass, O(n))
  let tracePointCount = 0;
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace') {
      for (const point of stroke.points) {
        getOrCreateNode(point.x, point.y, 'trace_point');
        const coordKey = createCoordKey(point.x, point.y);
        if (point.id !== undefined) {
        pointIdToCoord.set(point.id, coordKey);
        }
        tracePointCount++;
      }
    }
  }
  console.log(`[Connectivity] Added ${tracePointCount} trace points to coordinate graph`);
  
  // 3. Add power nodes (single pass, O(n))
  for (const power of powerSymbols) {
    const bus = powerBuses.find(b => b.id === power.powerBusId);
    getOrCreateNode(power.x, power.y, 'power', {
      voltage: bus?.voltage || power.type || 'UNKNOWN',
      powerBusId: power.powerBusId,
    });
    if (power.pointId !== undefined) {
      const coordKey = createCoordKey(power.x, power.y);
      pointIdToCoord.set(power.pointId, coordKey);
    }
  }
  
  // 4. Add ground nodes (single pass, O(n))
  for (const ground of groundSymbols) {
    // Store groundBusId if available (for grouping by bus name)
    const groundWithBusId = ground as GroundSymbol & { groundBusId?: string; pointId?: number };
    getOrCreateNode(ground.x, ground.y, 'ground', {
      groundBusId: groundWithBusId.groundBusId,
    });
    // Note: GroundSymbol may have pointId if added dynamically
    if (groundWithBusId.pointId !== undefined) {
      const coordKey = createCoordKey(ground.x, ground.y);
      pointIdToCoord.set(groundWithBusId.pointId, coordKey);
    }
  }
  
  // 5. Add component pin nodes - ONLY for pins that are actually connected
  // Build a map of all existing coordinates for comparison
  const existingCoords = new Set<string>();
  for (const [coordKey] of coordinateToNode) {
    existingCoords.add(coordKey);
  }
  
  // Track component pins that don't have valid connections
  const unconnectedPins: Array<{ compId: string; designator: string; pinIndex: number; pointId: string }> = [];
  let connectedPinCount = 0;
  
  for (const comp of components) {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim() || 'UNKNOWN';
    
    for (let pinIndex = 0; pinIndex < comp.pinCount; pinIndex++) {
      // Only add pins that have a connection (point ID reference)
      const pinConnection = comp.pinConnections?.[pinIndex];
      
      if (pinConnection && pinConnection.trim() !== '') {
        // Pin claims to be connected - find the actual coordinates of the connected point
        const pointId = parseInt(pinConnection.trim(), 10);
        if (!isNaN(pointId) && pointId > 0) {
          // O(1) lookup: Get coordinates from pointIdToCoord hash map
          const connectedCoordKey = pointIdToCoord.get(pointId);
          if (connectedCoordKey) {
            // Use the connected point's coordinates - this pin is actually connected
            const [x, y] = connectedCoordKey.split(',').map(Number);
            getOrCreateNode(x, y, 'component_pin', {
              componentId: comp.id,
              pinIndex: pinIndex,
            });
            connectedPinCount++;
            console.log(`[Connectivity] Component ${designator} pin ${pinIndex + 1}: Connected to point ID ${pointId} at coord(${x},${y})`);
          } else {
            // Point ID not found in pointIdToCoord - check if it's a power/ground node
            // Power and ground nodes might not be in pointIdToCoord if they don't have pointId set
            // But we should still add the component pin at its calculated position
            // The pin will be connected through the net grouping if it's in the same net
            const pinPos = _calculateComponentPinPosition(comp, pinIndex);
            getOrCreateNode(pinPos.x, pinPos.y, 'component_pin', {
              componentId: comp.id,
              pinIndex: pinIndex,
            });
            // Also add the point ID to pointIdToCoord for future lookups
            const pinCoordKey = createCoordKey(pinPos.x, pinPos.y);
            pointIdToCoord.set(pointId, pinCoordKey);
            connectedPinCount++;
            console.warn(`[Connectivity] Component ${designator} pin ${pinIndex + 1}: Point ID ${pointId} not in pointIdToCoord, but adding pin at calculated position (${pinPos.x},${pinPos.y}) - may be connected to power/ground`);
          }
        } else {
          // Invalid point ID - pin is not connected
          unconnectedPins.push({
            compId: comp.id,
            designator,
            pinIndex: pinIndex,
            pointId: pinConnection.trim()
          });
          console.warn(`[Connectivity] Component ${designator} pin ${pinIndex + 1}: Invalid point ID "${pinConnection}" - pin is NOT connected`);
        }
      } else {
        // Pin not connected - don't add it to the graph
        // (Unconnected pins don't participate in connectivity)
      }
    }
  }
  
  // Log summary
  console.log(`[Connectivity] Added ${connectedPinCount} connected component pins to coordinate graph`);
  if (unconnectedPins.length > 0) {
    console.warn(`[Connectivity] Found ${unconnectedPins.length} component pins with invalid or missing connections (not added to graph):`);
    for (const pin of unconnectedPins.slice(0, 10)) { // Show first 10
      console.warn(`  - ${pin.designator} pin ${pin.pinIndex + 1}: point ID "${pin.pointId}" not found`);
    }
  }
  
  return coordinateToNode;
}

/**
 * Build connections from traces (coordinate-based)
 * Points with same coordinates are already the same node
 */
function buildConnectionsCoordinateBased(
  drawingStrokes: DrawingStroke[],
  _coordinateToNode: Map<string, NetlistNode>
): Array<[string, string]> {
  const connections: Array<[string, string]> = [];
  
  // Coordinate precision for matching (must match createCoordKey)
  const COORD_PRECISION = 6;
  const createCoordKey = (x: number, y: number): string => {
    const roundedX = Math.round(x * Math.pow(10, COORD_PRECISION)) / Math.pow(10, COORD_PRECISION);
    const roundedY = Math.round(y * Math.pow(10, COORD_PRECISION)) / Math.pow(10, COORD_PRECISION);
    return `${roundedX},${roundedY}`;
  };
  
  // Build connections from traces (connect consecutive points)
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        if (point1 && point2) {
          const coordKey1 = createCoordKey(point1.x, point1.y);
          const coordKey2 = createCoordKey(point2.x, point2.y);
          // Only add connection if coordinates are different
          if (coordKey1 !== coordKey2) {
            connections.push([coordKey1, coordKey2]);
          }
        }
      }
    }
  }
  
  return connections;
}

/**
 * Normalize voltage string for consistent grouping
 * Handles variations like "+3.3V", "3.3V", "+3.3 VDC", "+3.3VDC" etc.
 * Preserves the sign (+ or -) and extracts the numeric value
 */
function normalizeVoltage(voltage: string): string {
  if (!voltage) return 'UNKNOWN';
  
  // Trim whitespace
  let normalized = voltage.trim();
  
  // Remove common suffixes like "VDC", "VAC", "DC", "AC", or standalone "V" (case insensitive)
  // Handle these in order: VDC/VAC first, then DC/AC, then standalone V
  normalized = normalized.replace(/\s*(VDC|VAC)\s*$/i, '');
  normalized = normalized.replace(/\s*(DC|AC)\s*$/i, '');
  normalized = normalized.replace(/\s*V\s*$/i, '');
  
  // Extract sign (+ or -) and numeric value
  const signMatch = normalized.match(/^([+-])?/);
  const sign = signMatch ? signMatch[1] || '+' : '+';
  
  // Extract numeric part (allows decimals)
  const numMatch = normalized.match(/(\d+\.?\d*)/);
  if (!numMatch) {
    // If no numeric value found, return original (trimmed) for fallback
    return voltage.trim();
  }
  
  let numValue = numMatch[1];
  
  // KiCad convention: for decimals, use format like "3V3" instead of "3.3V"
  // Example: 3.3 becomes 3V3, 5.0 becomes 5V0, 12.5 becomes 12V5
  if (numValue.includes('.')) {
    const parts = numValue.split('.');
    const wholePart = parts[0];
    const decimalPart = parts[1] || '0';
    // Remove trailing zeros from decimal part
    const cleanDecimal = decimalPart.replace(/0+$/, '') || '0';
    numValue = `${wholePart}V${cleanDecimal}`;
  }
  
  // Return normalized format: sign + numeric value + "V" (KiCad convention)
  // This ensures "+3.3V", "3.3V", "+3.3 VDC" all become "+3V3" (or "+5V" for whole numbers)
  return `${sign}${numValue}V`;
}

/**
 * Group connected nodes into nets using union-find (coordinate-based)
 * CRITICAL: All power nodes with the same PowerBus name are directly connected by definition.
 * CRITICAL: All ground nodes with the same GroundBus name are directly connected by definition.
 */
export function groupNodesIntoNetsCoordinateBased(
  coordinateToNode: Map<string, NetlistNode>,
  connections: Array<[string, string]>,
  powerBuses: PowerBus[] = [],
  groundBuses: GroundBus[] = []
): Map<string, NetlistNode[]> {
  const uf = new UnionFind();
  
  // Create a map from coordinate key to integer ID for union-find
  const coordKeyToIntId = new Map<string, number>();
  let intIdCounter = 1;
  const getIntId = (coordKey: string): number => {
    if (!coordKeyToIntId.has(coordKey)) {
      coordKeyToIntId.set(coordKey, intIdCounter++);
    }
    return coordKeyToIntId.get(coordKey)!;
  };
  
  // Union nodes connected by traces
  for (const [coordKey1, coordKey2] of connections) {
    const intId1 = getIntId(coordKey1);
    const intId2 = getIntId(coordKey2);
    uf.union(intId1, intId2);
  }
  
  // CRITICAL: Union all nodes with the same GroundBus together
  // All nodes with the same GroundBus are directly connected by definition
  // Group nodes by groundBusId (or default to single bus if no bus specified)
  // NOTE: Check for groundBusId property, NOT just type === 'ground'
  // When a ground node and via/pad share the same coordinates, they get merged.
  // The merged node keeps type 'via' or 'pad' but has groundBusId set.
  const groundNodesByBus = new Map<string, string[]>();
  for (const [coordKey, node] of coordinateToNode) {
    // Check for groundBusId property (includes merged via/ground nodes)
    if (node.groundBusId) {
      const busId = node.groundBusId;
      if (!groundNodesByBus.has(busId)) {
        groundNodesByBus.set(busId, []);
      }
      groundNodesByBus.get(busId)!.push(coordKey);
      getIntId(coordKey); // Ensure it's in the union-find structure
    }
  }
  // Union all ground nodes with the same bus ID
  for (const [busId, coordKeys] of groundNodesByBus) {
    if (coordKeys.length > 0) {
      // Get bus name for logging
      const bus = groundBuses.find(b => b.id === busId);
      const busName = bus?.name || (busId === 'default' ? 'GND' : busId);
      if (coordKeys.length > 1) {
        const firstGroundId = getIntId(coordKeys[0]);
        for (let i = 1; i < coordKeys.length; i++) {
          const otherGroundId = getIntId(coordKeys[i]);
        uf.union(firstGroundId, otherGroundId);
      }
        console.log(`[Connectivity] Unified ${coordKeys.length} ground nodes with bus "${busName}" into a single net (common ground bus)`);
    } else {
        console.log(`[Connectivity] Found 1 ground node with bus "${busName}" (common ground bus)`);
      }
    }
  }
  
  // CRITICAL: Union all nodes with the same PowerBus together
  // All nodes with the same PowerBus are directly connected by definition
  // Group nodes by powerBusId (not just voltage, since multiple buses can have same voltage)
  // NOTE: Check for powerBusId property, NOT just type === 'power'
  // When a power node and via/pad share the same coordinates, they get merged.
  // The merged node keeps type 'via' or 'pad' but has powerBusId set.
  const powerNodesByBus = new Map<string, string[]>();
  for (const [coordKey, node] of coordinateToNode) {
    // Check for powerBusId property (includes merged via/power nodes)
    if (node.powerBusId) {
      const busId = node.powerBusId;
      if (!powerNodesByBus.has(busId)) {
        powerNodesByBus.set(busId, []);
      }
      powerNodesByBus.get(busId)!.push(coordKey);
      getIntId(coordKey); // Ensure it's in the union-find structure
    }
  }
  // Union all power nodes with the same bus ID
  for (const [busId, coordKeys] of powerNodesByBus) {
    if (coordKeys.length > 0) {
      // Get bus name for logging
      const bus = powerBuses.find(b => b.id === busId);
      const busName = bus?.name || busId;
      if (coordKeys.length > 1) {
        const firstPowerId = getIntId(coordKeys[0]);
        for (let i = 1; i < coordKeys.length; i++) {
          const otherPowerId = getIntId(coordKeys[i]);
          uf.union(firstPowerId, otherPowerId);
        }
        console.log(`[Connectivity] Unified ${coordKeys.length} power nodes with bus "${busName}" into a single net (common power bus)`);
      } else {
        console.log(`[Connectivity] Found 1 power node with bus "${busName}" (common power bus)`);
      }
    }
  }
  
  // Ensure all other nodes are included (even if not connected by traces, ground, or power)
  for (const coordKey of coordinateToNode.keys()) {
    getIntId(coordKey); // Ensure it's in the union-find structure
  }
  
  // Get groups
  const groups = uf.getGroups();
  const netGroups = new Map<string, NetlistNode[]>();
  
  // Map integer IDs back to coordinate keys
  const intIdToCoordKey = new Map<number, string>();
  for (const [coordKey, intId] of coordKeyToIntId) {
    intIdToCoordKey.set(intId, coordKey);
  }
  
  for (const [rootIntId, intIds] of groups) {
    const rootCoordKey = intIdToCoordKey.get(rootIntId);
    if (!rootCoordKey) continue;
    
    const netNodes = intIds
      .map(intId => intIdToCoordKey.get(intId))
      .filter((coordKey): coordKey is string => coordKey !== undefined)
      .map(coordKey => coordinateToNode.get(coordKey))
      .filter((node): node is NetlistNode => node !== undefined);
    
    netGroups.set(rootCoordKey, netNodes);
  }
  
  return netGroups;
}

/**
 * Build connectivity graph from PCB elements (Node ID-based method)
 * CRITICAL: Uses Node IDs to determine connectivity, NOT coordinates.
 * When a Via and Power/Ground symbol share the same Node ID, they represent
 * the same electrical node. The power/ground properties are MERGED into the
 * existing node, preserving the original type while adding bus information.
 */
export function buildConnectivityGraph(
  drawingStrokes: DrawingStroke[],
  components: PCBComponent[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[],
  groundBuses: GroundBus[] = []
): Map<number, NetlistNode> {
  const nodes = new Map<number, NetlistNode>();
  
  // Add nodes from drawing strokes (traces, vias, and pads)
  // CRITICAL: If a via and a trace point share the same Node ID, they're the same node
  // The map key is the Node ID, so nodes with the same ID automatically merge
  let viaCount = 0;
  let padCount = 0;
  let tracePointCount = 0;
  let sharedNodeIds = 0; // Track when vias/pads share Node IDs with trace points
  
  for (const stroke of drawingStrokes) {
    if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
      const point = stroke.points[0];
      if (point.id !== undefined) {
        if (!nodes.has(point.id)) {
          // New node - create it
          nodes.set(point.id, {
            id: point.id,
            type: stroke.type === 'via' ? 'via' : 'pad',
            x: point.x,
            y: point.y,
          });
          if (stroke.type === 'via') viaCount++;
          else padCount++;
        } else {
          // Node already exists (likely from a trace point) - mark that it's also a via/pad
          const existingNode = nodes.get(point.id)!;
          // If it was a trace_point, it's now also a via/pad (they share the same Node ID)
          if (existingNode.type === 'trace_point') {
            sharedNodeIds++;
            // Keep the type as via/pad since that's more specific
            existingNode.type = stroke.type === 'via' ? 'via' : 'pad';
          }
        }
      }
    } else if (stroke.type === 'trace') {
      // Add all points in the trace
      for (const point of stroke.points) {
        if (point.id !== undefined) {
          if (!nodes.has(point.id)) {
            // New node - create it as trace_point
            nodes.set(point.id, {
              id: point.id,
              type: 'trace_point',
              x: point.x,
              y: point.y,
            });
            tracePointCount++;
          } else {
            // Node already exists (likely from a via/pad) - it's now also a trace point
            const existingNode = nodes.get(point.id)!;
            if (existingNode.type === 'via' || existingNode.type === 'pad') {
              sharedNodeIds++;
              // Keep the type as via/pad since that's more specific
            }
          }
        }
      }
    }
  }
  console.log(`[Connectivity-NodeID] Added ${viaCount} vias, ${padCount} pads, ${tracePointCount} trace points to graph`);
  if (sharedNodeIds > 0) {
    console.log(`[Connectivity-NodeID] Found ${sharedNodeIds} nodes where vias/pads share Node IDs with trace points (automatic connection)`);
  }
  
  // Add/merge power nodes - CRITICAL: MERGE with existing nodes, don't overwrite!
  // When a Power symbol shares the same Node ID with a Via, merge the power bus info
  let powerNodesMerged = 0;
  let powerNodesNew = 0;
  for (const power of powerSymbols) {
    if (power.pointId !== undefined) {
      const bus = powerBuses.find(b => b.id === power.powerBusId);
      const voltage = bus?.voltage || power.type || 'UNKNOWN';
      
      if (nodes.has(power.pointId)) {
        // MERGE: Existing node (via/pad/trace_point) - add power bus info
        const existingNode = nodes.get(power.pointId)!;
        existingNode.voltage = voltage;
        existingNode.powerBusId = power.powerBusId;
        powerNodesMerged++;
        console.log(`[Connectivity-NodeID] Power node merged: Node ID ${power.pointId} (${existingNode.type}) now has powerBusId=${power.powerBusId}, voltage=${voltage}`);
      } else {
        // NEW: Create power node
      nodes.set(power.pointId, {
        id: power.pointId,
        type: 'power',
        x: power.x,
        y: power.y,
          voltage: voltage,
        powerBusId: power.powerBusId,
      });
        powerNodesNew++;
    }
  }
  }
  console.log(`[Connectivity-NodeID] Power nodes: ${powerNodesMerged} merged with existing vias/pads, ${powerNodesNew} new`);
  
  // Add/merge ground nodes - CRITICAL: MERGE with existing nodes, don't overwrite!
  // When a Ground symbol shares the same Node ID with a Via, merge the ground bus info
  let groundNodesMerged = 0;
  let groundNodesNew = 0;
  for (const ground of groundSymbols) {
    const groundWithBusId = ground as GroundSymbol & { pointId?: number; groundBusId?: string };
    if (groundWithBusId.pointId !== undefined) {
      // Find the ground bus for this ground symbol
      const bus = groundBuses.find(b => b.id === groundWithBusId.groundBusId);
      const groundBusId = groundWithBusId.groundBusId || (bus?.id) || 'default';
      
      if (nodes.has(groundWithBusId.pointId)) {
        // MERGE: Existing node (via/pad/trace_point) - add ground bus info
        const existingNode = nodes.get(groundWithBusId.pointId)!;
        existingNode.groundBusId = groundBusId;
        groundNodesMerged++;
        console.log(`[Connectivity-NodeID] Ground node merged: Node ID ${groundWithBusId.pointId} (${existingNode.type}) now has groundBusId=${groundBusId}`);
      } else {
        // NEW: Create ground node
        nodes.set(groundWithBusId.pointId, {
          id: groundWithBusId.pointId,
        type: 'ground',
        x: ground.x,
        y: ground.y,
          groundBusId: groundBusId,
      });
        groundNodesNew++;
    }
  }
  }
  console.log(`[Connectivity-NodeID] Ground nodes: ${groundNodesMerged} merged with existing vias/pads, ${groundNodesNew} new`)
  
  // Add component pin nodes
  // IMPORTANT: Component pins reference point IDs that may already exist as vias, trace points, etc.
  // When a component pin references a point ID, we need to ensure that node is marked as a component pin
  // but preserve its connection to other nodes through traces
  let componentPinCount = 0;
  let componentPinConnectedToExisting = 0;
  let componentPinIsolated = 0;
  for (const comp of components) {
    // Get the actual designator (abbreviation takes precedence)
    const actualDesignator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (!actualDesignator) continue; // Skip components without designators
    
    for (let pinIndex = 0; pinIndex < comp.pinCount; pinIndex++) {
      const nodeIdStr = comp.pinConnections?.[pinIndex] || '';
      if (nodeIdStr && nodeIdStr.trim() !== '') {
        const nodeId = parseInt(nodeIdStr.trim(), 10);
        if (!isNaN(nodeId) && nodeId > 0) {
          componentPinCount++;
          // If node doesn't exist yet, create it as a component pin
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              type: 'component_pin',
              x: comp.x,
              y: comp.y,
              componentId: comp.id,
              pinIndex: pinIndex,
            });
            componentPinIsolated++;
            console.warn(`[Connectivity] Component ${actualDesignator} pin ${pinIndex + 1}: Node ID ${nodeId} does NOT exist in vias/pads/traces - creating isolated component pin node`);
          } else {
            // Update existing node to mark it as a component pin
            // This handles the case where a component pin is connected to a via or trace point
            const node = nodes.get(nodeId)!;
            const originalType = node.type;
            // Preserve the original type if it's important, but mark as component pin
            // Actually, for netlist output, we need to know it's a component pin
            node.componentId = comp.id;
            node.pinIndex = pinIndex;
            // Keep the type as component_pin for output purposes
            // But the node is still connected to other nodes through its point ID
            node.type = 'component_pin';
            componentPinConnectedToExisting++;
            console.log(`[Connectivity] Component ${actualDesignator} pin ${pinIndex + 1}: Connected to existing Node ID ${nodeId} (was ${originalType})`);
          }
        }
      }
    }
  }
  console.log(`[Connectivity] Component pins: ${componentPinCount} total, ${componentPinConnectedToExisting} connected to existing nodes, ${componentPinIsolated} isolated (no matching via/pad/trace)`);
  
  return nodes;
}

/**
 * Build connections from drawing strokes (traces connect points, vias are single points)
 * Also includes connections from component pins, power, and ground nodes that share point IDs
 * CRITICAL: Nodes with the same Node ID are already the same node in the map (no connection needed)
 * We only need to connect nodes with different Node IDs through trace paths
 */
// @ts-ignore - Reserved for future use
function buildConnections(
  drawingStrokes: DrawingStroke[],
  _nodes: Map<number, NetlistNode>
): Array<[number, number]> {
  const connections: Array<[number, number]> = [];
  
  // Build connections from traces (connect consecutive points with different Node IDs)
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      // Connect consecutive points in the trace
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        if (point1 && point2 && point1.id !== undefined && point2.id !== undefined) {
          // Only connect if they have different Node IDs
          // If point1.id === point2.id, they're already the same node (no connection needed)
          if (point1.id !== point2.id) {
            connections.push([point1.id, point2.id]);
          }
        }
      }
    }
  }
  
  // All nodes with the same Node ID are automatically the same node (same key in the map)
  // This handles:
  // - Vias and trace points that share Node IDs (automatic connection)
  // - Component pins connected to vias/trace points (same Node ID)
  // - Power/ground nodes connected to vias/traces (same Node ID)
  // The union-find algorithm will group nodes connected through traces
  
  return connections;
}

/**
 * Group connected nodes into nets using union-find (Node ID-based)
 * Note: Nodes with the same point ID are already the same node (same key in the map)
 * This function groups nodes that are connected through traces
 * CRITICAL: All nodes with the same groundBusId are connected by definition.
 * CRITICAL: All nodes with the same powerBusId are connected by definition.
 * NOTE: Check for groundBusId/powerBusId properties, NOT just type === 'ground'/'power'
 * When a power/ground node shares the same Node ID with a via/pad, the via/pad
 * keeps its type but has groundBusId/powerBusId/voltage properties set.
 */
export function groupNodesIntoNets(
  nodes: Map<number, NetlistNode>,
  connections: Array<[number, number]>,
  powerBuses: PowerBus[] = [],
  groundBuses: GroundBus[] = []
): Map<number, NetlistNode[]> {
  const uf = new UnionFind();
  
  // Union nodes connected by traces
  // Note: If a component pin, via, power, or ground node shares the same point ID,
  // they're already the same node in the map (same key), so no need to union them
  let connectionCount = 0;
  let missingNodeCount = 0;
  for (const [nodeId1, nodeId2] of connections) {
    if (nodes.has(nodeId1) && nodes.has(nodeId2)) {
      uf.union(nodeId1, nodeId2);
      connectionCount++;
    } else {
      if (!nodes.has(nodeId1)) missingNodeCount++;
      if (!nodes.has(nodeId2)) missingNodeCount++;
    }
  }
  console.log(`[Connectivity-NodeID] Union-find: Processed ${connections.length} connections, ${connectionCount} valid, ${missingNodeCount} missing nodes`);
  
  // CRITICAL: Union all nodes with the same groundBusId together
  // Check for groundBusId property (not just type === 'ground') to handle merged via/ground nodes
  const groundNodesByBus = new Map<string, number[]>();
  for (const [nodeId, node] of nodes) {
    if (node.groundBusId) {
      const busId = node.groundBusId;
      if (!groundNodesByBus.has(busId)) {
        groundNodesByBus.set(busId, []);
      }
      groundNodesByBus.get(busId)!.push(nodeId);
    }
  }
  // Union all nodes with the same ground bus
  for (const [busId, nodeIds] of groundNodesByBus) {
    if (nodeIds.length > 0) {
      const bus = groundBuses.find(b => b.id === busId);
      const busName = bus?.name || (busId === 'default' ? 'GND' : busId);
      if (nodeIds.length > 1) {
        const firstGroundId = nodeIds[0];
        for (let i = 1; i < nodeIds.length; i++) {
          uf.union(firstGroundId, nodeIds[i]);
      }
        console.log(`[Connectivity-NodeID] Unified ${nodeIds.length} nodes with groundBusId="${busName}" into a single net`);
    } else {
        console.log(`[Connectivity-NodeID] Found 1 node with groundBusId="${busName}"`);
      }
    }
  }
  
  // CRITICAL: Union all nodes with the same powerBusId together
  // Check for powerBusId property (not just type === 'power') to handle merged via/power nodes
  const powerNodesByBus = new Map<string, number[]>();
  for (const [nodeId, node] of nodes) {
    if (node.powerBusId) {
      const busId = node.powerBusId;
      if (!powerNodesByBus.has(busId)) {
        powerNodesByBus.set(busId, []);
      }
      powerNodesByBus.get(busId)!.push(nodeId);
    }
  }
  // Union all nodes with the same power bus
  for (const [busId, nodeIds] of powerNodesByBus) {
    if (nodeIds.length > 0) {
      const bus = powerBuses.find(b => b.id === busId);
      const busName = bus?.name || busId;
      if (nodeIds.length > 1) {
        const firstPowerId = nodeIds[0];
        for (let i = 1; i < nodeIds.length; i++) {
          uf.union(firstPowerId, nodeIds[i]);
        }
        console.log(`[Connectivity-NodeID] Unified ${nodeIds.length} nodes with powerBusId="${busName}" into a single net`);
      } else {
        console.log(`[Connectivity-NodeID] Found 1 node with powerBusId="${busName}"`);
      }
    }
  }
  
  // Also ensure all other nodes are included (even if not connected by traces, ground, or power)
  // This handles isolated nodes (unconnected component pins, etc.)
  for (const nodeId of nodes.keys()) {
    uf.find(nodeId); // Ensure node is in the union-find structure
  }
  
  // Get groups
  const groups = uf.getGroups();
  const netGroups = new Map<number, NetlistNode[]>();
  
  console.log(`[Connectivity] Union-find created ${groups.size} net groups`);
  
  // Debug: Show distribution of net sizes
  const netSizeDistribution = new Map<number, number>(); // size -> count
  for (const [, nodeIds] of groups) {
    const size = nodeIds.length;
    netSizeDistribution.set(size, (netSizeDistribution.get(size) || 0) + 1);
  }
  console.log(`[Connectivity] Net size distribution:`, Array.from(netSizeDistribution.entries()).sort((a, b) => b[0] - a[0]).slice(0, 10));
  
  for (const [root, nodeIds] of groups) {
    const netNodes = nodeIds
      .map(id => nodes.get(id))
      .filter((node): node is NetlistNode => node !== undefined);
    netGroups.set(root, netNodes);
  }
  
  return netGroups;
}

/**
 * Generate net names based on node types (coordinate-based version)
 * NOTE: Check for groundBusId/powerBusId properties, NOT just type === 'ground'/'power'
 * When a power/ground node and via/pad share the same coordinates, they get merged.
 * The merged node keeps type 'via' or 'pad' but has groundBusId/powerBusId/voltage set.
 */
export function generateNetNamesCoordinateBased(
  netGroups: Map<string, NetlistNode[]>,
  _coordinateToNode: Map<string, NetlistNode>
): Map<string, string> {
  const netNames = new Map<string, string>();
  let signalNetCounter = 1;
  
  for (const [rootCoordKey, netNodes] of netGroups) {
    // Check for ground nodes (includes merged via/ground nodes with groundBusId)
    const hasGround = netNodes.some(n => n.type === 'ground' || n.groundBusId);
    if (hasGround) {
      netNames.set(rootCoordKey, 'GND');
      continue;
    }
    
    // Check for power nodes (includes merged via/power nodes with powerBusId/voltage)
    const powerNodes = netNodes.filter(n => n.type === 'power' || n.powerBusId || n.voltage);
    if (powerNodes.length > 0) {
      // Use the voltage from the first power node
      const voltage = powerNodes[0].voltage || 'UNKNOWN';
      // Format voltage to KiCad standard notation (+5V, -3V3, etc.)
      const cleanVoltage = normalizeVoltage(voltage);
      netNames.set(rootCoordKey, cleanVoltage);
      continue;
    }
    
    // Signal nets: sequential names
    netNames.set(rootCoordKey, `N$${signalNetCounter++}`);
  }
  
  return netNames;
}

/**
 * Helper to read value and unit from component
 */
function readValueAndUnit(
  component: any,
  valueField: string,
  unitField: string,
  defaultUnit: string
): { value: string; unit: string } {
  // Special case: power is always stored as combined value+unit (e.g., "1/4W", "1W")
  if (valueField === 'power') {
    const powerValue = component[valueField] || '';
    if (typeof powerValue === 'string' && powerValue.trim() !== '') {
      // Remove trailing "W" if present
      const value = powerValue.replace(/W$/i, '').trim();
      return { value, unit: 'W' };
    }
    return { value: '', unit: 'W' };
  }
  
  // Try to read separate fields first (new format)
  if (component[valueField] !== undefined || component[unitField] !== undefined) {
    return {
      value: component[valueField] || '',
      unit: component[unitField] || defaultUnit,
    };
  }
  
  // Fallback: parse combined string if no separate fields
  const combined = component[valueField] || '';
  if (typeof combined === 'string' && combined.trim() !== '') {
    // Try to match fractional values (e.g., "1/4W", "1/2W") or number followed by unit
    const fractionalMatch = combined.trim().match(/^([\d]+\/[\d]+)\s*([a-zA-ZΩµμuW]+)?$/);
    if (fractionalMatch) {
      return { value: fractionalMatch[1], unit: fractionalMatch[2] || '' };
    }
    
    // Try to match number followed by unit (handles k, M, m, µ, u, etc.)
    const match = combined.trim().match(/^([\d.]+)\s*([a-zA-ZΩµμuW]+)?$/);
    if (match) {
      return { value: match[1], unit: match[2] || '' };
    }
    
    // If no match, return as-is
    return { value: combined.trim(), unit: '' };
  }
  
  return { value: '', unit: defaultUnit };
}

/**
 * Helper to combine value and unit into a single string
 */
function combineValueAndUnit(value: string, unit: string): string {
  if (!value || value.trim() === '') return '';
  if (!unit || unit.trim() === '') return value.trim();
  return `${value.trim()}${unit.trim()}`;
}

/**
 * Get default unit for a property
 */
export function getDefaultUnit(property: string): string {
  const unitMap: Record<string, string> = {
    resistance: 'Ω',
    capacitance: 'F',
    inductance: 'H',
    voltage: 'V',
    current: 'A',
    power: 'W',
    impedance: 'Ω',
    capacity: 'mAh',
    esr: 'Ω',
    coilVoltage: 'V',
    inputVoltage: 'V',
    outputVoltage: 'V',
  };
  return unitMap[property] || '';
}

/**
 * Get component value for netlist with proper units
 * Prioritizes actual component values (resistance, capacitance, etc.) with units
 * For passive components: uses resistance/capacitance/inductance with units
 * For active components: uses partNumber or partName
 * Falls back to componentType if no specific value is available
 */
function getComponentValue(comp: PCBComponent): string {
  // For Resistor: use resistance with unit
  if (comp.componentType === 'Resistor' && 'resistance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Capacitor: use capacitance with unit
  if (comp.componentType === 'Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Electrolytic Capacitor: use capacitance with unit
  if (comp.componentType === 'Electrolytic Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Inductor: use inductance with unit
  if (comp.componentType === 'Inductor' && 'inductance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'inductance', 'inductanceUnit', getDefaultUnit('inductance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For ICs, Transistors, Diodes, and other active components: use partNumber or partName
  const partName = (comp as any).partName?.trim();
  if (partName && partName !== '') {
    return partName;
  }
  
  const partNumber = (comp as any).partNumber?.trim();
  if (partNumber && partNumber !== '') {
    return partNumber;
  }
  
  // Fallback to componentType
  return comp.componentType;
}

/**
 * Get component footprint for netlist
 */
function getComponentFootprint(comp: PCBComponent): string {
  if (comp.packageType) return comp.packageType;
  
  // Default footprints based on component type
  const footprintMap: Record<string, string> = {
    'Resistor': 'R_0805',
    'Capacitor': 'C_0805',
    'Inductor': 'L_0805',
    'Diode': 'D_SOD-123',
    'Transistor': 'TO-92',
    'IntegratedCircuit': 'DIP-8',
  };
  
  return footprintMap[comp.componentType] || 'Unknown';
}

/**
 * Generate KiCad netlist (coordinate-based version)
 */
export function generateKiCadNetlist(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): string {
  // Use coordinate-based connectivity
  const coordinateToNode = buildConnectivityGraphCoordinateBased(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses
  );
  
  const connections = buildConnectionsCoordinateBased(drawingStrokes, coordinateToNode);
  const netGroups = groupNodesIntoNetsCoordinateBased(coordinateToNode, connections);
  const netNames = generateNetNamesCoordinateBased(netGroups, coordinateToNode);
  
  // Build component map
  const componentMap = new Map<string, PCBComponent>();
  for (const comp of components) {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (designator) {
      componentMap.set(designator, comp);
    }
  }
  
  // Build nets with component pins
  const nets: Array<{ name: string; code: number; componentPins: Array<{ designator: string; pin: number }> }> = [];
  let netCode = 1;
  
  for (const [rootCoordKey, netNodes] of netGroups) {
    const netName = netNames.get(rootCoordKey) || `N$${netCode}`;
    const componentPins: Array<{ designator: string; pin: number }> = [];
    
    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        const comp = components.find(c => c.id === node.componentId);
        if (comp) {
          const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
          if (designator) {
            componentPins.push({ designator, pin: (node.pinIndex || 0) + 1 });
          }
        }
      }
    }
    
    if (componentPins.length > 0) {
      nets.push({ name: netName, code: netCode++, componentPins });
    }
  }
  
  // Sort nets: GND first, then power, then signals
  nets.sort((a, b) => {
    if (a.name === 'GND') return -1;
    if (b.name === 'GND') return 1;
    if (a.name.startsWith('+') || a.name.startsWith('-')) return -1;
    if (b.name.startsWith('+') || b.name.startsWith('-')) return 1;
    return a.code - b.code;
  });
  
  // Generate netlist
  let output = '(\n';
  output += '  (components\n';
  
  const sortedDesignators = Array.from(componentMap.keys()).sort();
  for (const designator of sortedDesignators) {
    const comp = componentMap.get(designator)!;
    const value = getComponentValue(comp);
    const footprint = getComponentFootprint(comp);
    
    output += `    (comp (ref ${designator})\n`;
    output += `      (value ${value})\n`;
    output += `      (footprint ${footprint})\n`;
    output += '    )\n';
  }
  
  output += '  )\n';
  output += '  (nets\n';
  
  for (const net of nets) {
    output += `    (net (code ${net.code}) (name ${net.name})\n`;
    for (const pin of net.componentPins) {
      output += `      (node (ref ${pin.designator}) (pin ${pin.pin}))\n`;
    }
    output += '    )\n';
  }
  
  output += '  )\n';
  output += ')\n';
  
  return output;
}

/**
 * Generate Protel netlist (coordinate-based version)
 */
export function generateProtelNetlist(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): string {
  // Use coordinate-based connectivity
  const coordinateToNode = buildConnectivityGraphCoordinateBased(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses
  );
  
  const connections = buildConnectionsCoordinateBased(drawingStrokes, coordinateToNode);
  const netGroups = groupNodesIntoNetsCoordinateBased(coordinateToNode, connections);
  const netNames = generateNetNamesCoordinateBased(netGroups, coordinateToNode);
  
  // Build component map
  const componentMap = new Map<string, PCBComponent>();
  for (const comp of components) {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (designator) {
      componentMap.set(designator, comp);
    }
  }
  
  // Collect all designators used in nets
  const designatorsInNets = new Set<string>();
  for (const [, netNodes] of netGroups) {
    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        const comp = components.find(c => c.id === node.componentId);
        if (comp) {
          const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
          if (designator) {
            designatorsInNets.add(designator);
          }
        }
      }
    }
  }
  
  // Generate Protel format
  let output = '';
  
  // Components section
  output += '[';
  const sortedDesignators = Array.from(designatorsInNets).sort();
  for (const designator of sortedDesignators) {
    const comp = componentMap.get(designator);
    if (!comp) continue;
    
    const footprint = comp.packageType || getComponentFootprint(comp);
    const value = getComponentValue(comp);
    
    output += `[${designator}\n`;
    output += `${footprint}\n`;
    output += `${value}\n`;
    output += '\n\n\n\n'; // Exactly 4 newlines as required by nl2sch
    output += ']';
  }
  output += ']\n';
  
  // Nets section
  output += '(\n';
  let netCode = 1;
  for (const [rootCoordKey, netNodes] of netGroups) {
    const netName = netNames.get(rootCoordKey) || `N$${netCode}`;
    const componentPins: Array<{ designator: string; pin: number }> = [];
    
    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        const comp = components.find(c => c.id === node.componentId);
        if (comp) {
          const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
          if (designator) {
            componentPins.push({ designator, pin: (node.pinIndex || 0) + 1 });
          }
        }
      }
    }
    
    if (componentPins.length > 0) {
      output += `(${netName}\n`;
      for (const pin of componentPins) {
        output += `  (${pin.designator}-${pin.pin})\n`;
      }
      output += ')\n';
    }
    netCode++;
  }
  output += ')\n';
  
  return output;
}

/**
 * Generate SPICE netlist (coordinate-based version)
 * SPICE format is used for circuit simulation
 */
export function generateSpiceNetlist(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): string {
  // Use coordinate-based connectivity
  const coordinateToNode = buildConnectivityGraphCoordinateBased(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses
  );
  
  const connections = buildConnectionsCoordinateBased(drawingStrokes, coordinateToNode);
  const netGroups = groupNodesIntoNetsCoordinateBased(coordinateToNode, connections);
  const netNames = generateNetNamesCoordinateBased(netGroups, coordinateToNode);
  
  // Build component map
  const componentMap = new Map<string, PCBComponent>();
  for (const comp of components) {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (designator) {
      componentMap.set(designator, comp);
    }
  }
  
  // Map component types to SPICE prefixes
  const getSpicePrefix = (comp: PCBComponent): string => {
    switch (comp.componentType) {
      case 'Resistor': return 'R';
      case 'Capacitor': return 'C';
      case 'Electrolytic Capacitor': return 'C';
      case 'Film Capacitor': return 'C';
      case 'Inductor': return 'L';
      case 'Diode': return 'D';
      case 'Transistor': return 'Q';
      case 'IntegratedCircuit': return 'X'; // ICs need subcircuit definitions
      case 'Switch': return 'S'; // Voltage-controlled switch
      case 'Battery': return 'V'; // Voltage source
      case 'Fuse': return 'R'; // Model fuse as small resistance
      case 'Jumper': return 'R'; // Model jumper as very small resistance
      default: return 'X'; // Generic subcircuit (needs definition)
    }
  };
  
  // Extract numeric part from designator (e.g., "R1" -> "1", "C2" -> "2")
  const getSpiceDesignator = (comp: PCBComponent): string => {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim() || '';
    // Extract number from designator (e.g., "R1" -> "1", "C2" -> "2", "U3" -> "3")
    const match = designator.match(/\d+/);
    if (match) {
      return match[0];
    }
    // Fallback: use component ID hash or index
    return comp.id.substring(0, 8);
  };
  
  // Get SPICE value string for component
  const getSpiceValue = (comp: PCBComponent): string => {
    // For Resistor: use resistance
    if (comp.componentType === 'Resistor' && 'resistance' in comp) {
      const { value, unit } = readValueAndUnit(comp, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      if (value && value.trim() !== '') {
        return combineValueAndUnit(value, unit);
      }
    }
    
    // For Capacitor/Electrolytic Capacitor: use capacitance
    if ((comp.componentType === 'Capacitor' || comp.componentType === 'Electrolytic Capacitor') && 'capacitance' in comp) {
      const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      if (value && value.trim() !== '') {
        return combineValueAndUnit(value, unit);
      }
    }
    
    // For Inductor: use inductance
    if (comp.componentType === 'Inductor' && 'inductance' in comp) {
      const { value, unit } = readValueAndUnit(comp, 'inductance', 'inductanceUnit', getDefaultUnit('inductance'));
      if (value && value.trim() !== '') {
        return combineValueAndUnit(value, unit);
      }
    }
    
    // For active components: use part number or part name
    const partName = (comp as any).partName?.trim();
    if (partName && partName !== '') {
      return partName;
    }
    
    const partNumber = (comp as any).partNumber?.trim();
    if (partNumber && partNumber !== '') {
      return partNumber;
    }
    
    // Fallback
    return comp.componentType;
  };
  
  // Build net to node name mapping
  const netToNodeName = new Map<string, string>();
  let signalNetCounter = 1;
  
  for (const [rootCoordKey] of netGroups) {
    const netName = netNames.get(rootCoordKey);
    if (!netName) continue;
    
    // Convert net name to SPICE node name
    let nodeName: string;
    if (netName === 'GND') {
      nodeName = '0'; // SPICE uses '0' for ground
    } else if (netName.startsWith('+') || netName.startsWith('-')) {
      // Power net: clean up the name (remove spaces, ensure valid SPICE identifier)
      nodeName = netName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_+-]/g, '_');
    } else {
      // Signal net: use N1, N2, etc.
      nodeName = `N${signalNetCounter++}`;
    }
    
    netToNodeName.set(rootCoordKey, nodeName);
  }
  
  // Create reverse mapping: netName -> nodeName for power nets
  const powerNetToNodeName = new Map<string, string>();
  for (const [rootCoordKey, nodeName] of netToNodeName.entries()) {
    const netName = netNames.get(rootCoordKey);
    if (netName && (netName.startsWith('+') || netName.startsWith('-'))) {
      powerNetToNodeName.set(netName, nodeName);
    }
  }
  
  // Generate SPICE netlist
  let output = '* SPICE Netlist\n';
  output += `* Generated from PCB Reverse Engineering Tool\n*\n\n`;
  
  // Generate components
  const sortedDesignators = Array.from(componentMap.keys()).sort();
  for (const designator of sortedDesignators) {
    const comp = componentMap.get(designator)!;
    const prefix = getSpicePrefix(comp);
    const value = getSpiceValue(comp);
    
    // Get connected pins and their net assignments
    const pinConnections: Array<{ pinIndex: number; nodeName: string }> = [];
    
    for (const [rootCoordKey, netNodes] of netGroups) {
      const nodeName = netToNodeName.get(rootCoordKey);
      if (!nodeName) continue;
      
      for (const node of netNodes) {
        if (node.type === 'component_pin' && node.componentId === comp.id && node.pinIndex !== undefined) {
          pinConnections.push({ pinIndex: node.pinIndex, nodeName });
        }
      }
    }
    
    // Sort by pin index
    pinConnections.sort((a, b) => a.pinIndex - b.pinIndex);
    
    // Generate component line
    // Format: PREFIX NUMBER NODE1 NODE2 ... VALUE
    // Use numeric part of designator (e.g., "R1" -> "1", not "RR1")
    const spiceDesignator = getSpiceDesignator(comp);
    
    // Handle special cases for components that need different SPICE syntax
    if (comp.componentType === 'Switch') {
      // Voltage-controlled switch: S<name> <+node> <-node> <+cont> <-cont> <model> [ON|OFF]
      // For now, use a simple behavioral model or comment it out
      if (pinConnections.length >= 2) {
        output += `* Switch ${designator}: ${comp.componentType} - needs manual modeling\n`;
        output += `* S${spiceDesignator} ${pinConnections[0].nodeName} ${pinConnections[1].nodeName} 0 0 SW_MODEL\n`;
      }
    } else if (comp.componentType === 'IntegratedCircuit') {
      // ICs need subcircuit definitions - use X prefix and part number as subcircuit name
      const partNum = (comp as any).partNumber?.trim() || (comp as any).partName?.trim() || comp.componentType;
      if (pinConnections.length > 0) {
        output += `X${spiceDesignator}`;
        for (const conn of pinConnections) {
          output += ` ${conn.nodeName}`;
        }
        // Use part number as subcircuit name (user needs to define .subckt)
        output += ` ${partNum}\n`;
        output += `* Note: Subcircuit definition for ${partNum} must be provided\n`;
      }
    } else if (comp.componentType === 'Battery') {
      // Battery as voltage source: V<name> <+node> <-node> [DC|AC] <value>
      const voltage = getSpiceValue(comp);
      if (pinConnections.length >= 2) {
        output += `V${spiceDesignator} ${pinConnections[0].nodeName} ${pinConnections[1].nodeName} DC ${voltage || '5'}\n`;
      }
    } else {
      // Standard components (R, C, L, D, Q, etc.)
      if (pinConnections.length > 0) {
        output += `${prefix}${spiceDesignator}`;
        for (const conn of pinConnections) {
          output += ` ${conn.nodeName}`;
        }
        // Only add value if it's not empty and component type supports it
        if (value && value.trim() !== '' && 
            (comp.componentType === 'Resistor' || 
             comp.componentType === 'Capacitor' || 
             comp.componentType === 'Electrolytic Capacitor' ||
             comp.componentType === 'Film Capacitor' ||
             comp.componentType === 'Inductor' ||
             comp.componentType === 'Diode')) {
          output += ` ${value}`;
        }
        output += '\n';
      } else {
        // Component with no connections - still include it but with placeholder nodes
        const pinCount = comp.pinCount || 2;
        output += `${prefix}${spiceDesignator}`;
        for (let i = 0; i < pinCount; i++) {
          output += ` NC${i + 1}`; // NC = No Connection
        }
        if (value && value.trim() !== '') {
          output += ` ${value}`;
        }
        output += '\n';
      }
    }
  }
  
  // Add power/voltage sources if we have power nets
  const powerNets = new Set<string>();
  for (const [rootCoordKey] of netGroups) {
    const netName = netNames.get(rootCoordKey);
    if (netName && (netName.startsWith('+') || netName.startsWith('-'))) {
      powerNets.add(netName);
    }
  }
  
  if (powerNets.size > 0) {
    output += '\n* Power sources (user should define these)\n';
    let powerSourceCounter = 1;
    for (const powerNet of Array.from(powerNets).sort()) {
      const nodeName = powerNetToNodeName.get(powerNet) || powerNet.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_+-]/g, '_');
      // Extract voltage value from power net name (e.g., "+5V" -> "5")
      const voltageMatch = powerNet.match(/[+-]?[\d.]+/);
      const voltageValue = voltageMatch ? voltageMatch[0] : '5';
      output += `* V${powerSourceCounter++} ${nodeName} 0 DC ${voltageValue}\n`;
    }
  }
  
  // Add basic simulation command template
  output += '\n* Simulation commands (uncomment and modify as needed):\n';
  output += '* .op                    ; DC operating point\n';
  output += '* .tran 1ms 10ms         ; Transient analysis\n';
  output += '* .ac dec 10 1 1k        ; AC analysis\n';
  output += '\n.end\n';
  
  return output;
}

/**
 * @deprecated Use generateHybridNetlist from hybridNetlist.ts instead.
 * This function is kept for reference but is no longer used.
 * 
 * Generate PADS-PCB ASCII Format (JSON) - OLD FORMAT
 * CRITICAL: Uses Node ID-based connectivity, NOT coordinates.
 * When a Via and Power/Ground symbol share the same Node ID, they represent
 * the same electrical node. Component pins are connected via traces (shared Node IDs).
 */
// @ts-ignore - Deprecated function kept for reference
function generatePadsNetlist_DEPRECATED(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[],
  groundBuses: GroundBus[],
  projectName?: string
): string {
  console.log(`[Netlist-NodeID] Building connectivity graph using Node IDs...`);
  
  // Use Node ID-based connectivity (NOT coordinate-based)
  const nodes = buildConnectivityGraph(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses,
    groundBuses
  );
  
  // Build connections from traces (connect consecutive points by Node ID)
  // CRITICAL: Traces can ONLY connect through vias, pads, power, or ground nodes
  // Regular trace points do NOT have Node IDs and cannot form connections
  // This is by design: traces must connect through explicit connection points (vias/pads)
  const connections: Array<[number, number]> = [];
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      // Collect all points with Node IDs in this trace
      const nodesInTrace: Array<{ index: number; nodeId: number }> = [];
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        if (point && point.id !== undefined) {
          nodesInTrace.push({ index: i, nodeId: point.id });
        }
      }
      
      // Connect all nodes in this trace (they're all connected through the trace path)
      // Even if separated by intermediate points without Node IDs, they're on the same trace
      for (let i = 0; i < nodesInTrace.length; i++) {
        for (let j = i + 1; j < nodesInTrace.length; j++) {
          const nodeId1 = nodesInTrace[i].nodeId;
          const nodeId2 = nodesInTrace[j].nodeId;
          // Only connect if they have different Node IDs
          if (nodeId1 !== nodeId2) {
            connections.push([nodeId1, nodeId2]);
          }
        }
      }
    }
  }
  console.log(`[Netlist-NodeID] Built ${connections.length} trace connections`);
  
  // Group nodes into nets using Node ID-based union-find
  const netGroups = groupNodesIntoNets(nodes, connections, powerBuses, groundBuses);
  const netNames = generateNetNames(netGroups, nodes);
  
  // Trace power and ground bus connections through traces and pass-through components
  // Pass-through components: Jumper, Connector, Switch (no resistance, pass power/ground through)
  const componentPinBusNames = new Map<string, Set<string>>(); // Map: "componentId:pinIndex" -> Set of bus names
  
  // Helper to check if a component is a pass-through component
  const isPassThroughComponent = (comp: PCBComponent): boolean => {
    return comp.componentType === 'Jumper' || 
           comp.componentType === 'Connector' || 
           comp.componentType === 'Switch';
  };
  
  // Build a map of component pins to their Node IDs
  const componentPinToNodeId = new Map<string, number>(); // Map: "componentId:pinIndex" -> NodeId
  for (const [nodeId, node] of nodes) {
    if (node.componentId && node.pinIndex !== undefined) {
      const pinKey = `${node.componentId}:${node.pinIndex}`;
      componentPinToNodeId.set(pinKey, nodeId);
    }
  }
  
  // Build adjacency list for Node ID-based graph
  const nodeAdjacencyList = new Map<number, Set<number>>();
  for (const nodeId of nodes.keys()) {
    nodeAdjacencyList.set(nodeId, new Set());
  }
  for (const [nodeId1, nodeId2] of connections) {
    if (nodeAdjacencyList.has(nodeId1)) {
      nodeAdjacencyList.get(nodeId1)!.add(nodeId2);
    }
    if (nodeAdjacencyList.has(nodeId2)) {
      nodeAdjacencyList.get(nodeId2)!.add(nodeId1);
    }
  }
  
  // Helper function to trace from a Node ID and mark all reachable component pins
  const traceAndMarkPins = (startNodeId: number, busName: string, visited: Set<number>) => {
    if (visited.has(startNodeId)) return;
    visited.add(startNodeId);
    
    const node = nodes.get(startNodeId);
    if (!node) return;
    
    // CRITICAL: Check if this node represents a component pin (even if merged with power/ground)
    // Component pins can have the same Node ID as power/ground nodes, so the node might
    // have both componentId/pinIndex AND powerBusId/groundBusId properties
    if (node.componentId && node.pinIndex !== undefined) {
      const pinKey = `${node.componentId}:${node.pinIndex}`;
      if (!componentPinBusNames.has(pinKey)) {
        componentPinBusNames.set(pinKey, new Set());
      }
      componentPinBusNames.get(pinKey)!.add(busName);
      
      // If this component is a pass-through component, continue tracing through all its pins
      const comp = components.find(c => c.id === node.componentId);
      if (comp && isPassThroughComponent(comp)) {
        // For pass-through components, all pins are connected internally (no resistance)
        // So if one pin has the bus, all pins should have it
        for (let pinIndex = 0; pinIndex < comp.pinCount; pinIndex++) {
          const otherPinKey = `${comp.id}:${pinIndex}`;
          // Mark all pins of this pass-through component with the bus name
          if (!componentPinBusNames.has(otherPinKey)) {
            componentPinBusNames.set(otherPinKey, new Set());
          }
          componentPinBusNames.get(otherPinKey)!.add(busName);
          
          // Continue tracing from this pin's Node ID if it exists in the graph
          const otherPinNodeId = componentPinToNodeId.get(otherPinKey);
          if (otherPinNodeId !== undefined && !visited.has(otherPinNodeId)) {
            traceAndMarkPins(otherPinNodeId, busName, visited);
          }
        }
      }
    }
    
    // Continue tracing through connected nodes (traces)
    const neighbors = nodeAdjacencyList.get(startNodeId);
    if (neighbors) {
      for (const neighborNodeId of neighbors) {
        traceAndMarkPins(neighborNodeId, busName, visited);
      }
    }
  };
  
  // Trace from each power bus node
  // CRITICAL: Check for powerBusId property to find all nodes with this power bus
  // (includes merged via/power nodes that keep type 'via' but have powerBusId set)
  console.log(`[Netlist-NodeID] Tracing power bus connections through traces...`);
  for (const powerBus of powerBuses) {
    const busName = powerBus.name;
    const visited = new Set<number>();
    
    // Start DFS from all nodes with this power bus ID
    let powerNodeCount = 0;
    for (const [nodeId, node] of nodes) {
      if (node.powerBusId === powerBus.id) {
        powerNodeCount++;
        console.log(`[Netlist-NodeID] Starting trace from power node ID ${nodeId}, type=${node.type}, busId=${node.powerBusId}`);
        traceAndMarkPins(nodeId, busName, visited);
      }
    }
    console.log(`[Netlist-NodeID] Power bus "${busName}": Traced from ${powerNodeCount} node(s), visited ${visited.size} Node ID(s)`);
  }
  
  // Trace from each ground bus node
  // CRITICAL: Check for groundBusId property to find all nodes with this ground bus
  // (includes merged via/ground nodes that keep type 'via' but have groundBusId set)
  console.log(`[Netlist-NodeID] Tracing ground bus connections through traces...`);
  for (const groundBus of groundBuses) {
    const busName = groundBus.name;
    const visited = new Set<number>();
    
    // Start DFS from all nodes with this ground bus ID
    let groundNodeCount = 0;
    for (const [nodeId, node] of nodes) {
      if (node.groundBusId === groundBus.id) {
        groundNodeCount++;
        console.log(`[Netlist-NodeID] Starting trace from ground node ID ${nodeId}, type=${node.type}, busId=${node.groundBusId}`);
        traceAndMarkPins(nodeId, busName, visited);
      }
    }
    console.log(`[Netlist-NodeID] Ground bus "${busName}": Traced from ${groundNodeCount} node(s), visited ${visited.size} Node ID(s)`);
  }
  
  // Log summary of component pins with bus connections
  let pinsWithPower = 0;
  let pinsWithGround = 0;
  for (const [_pinKey, busNames] of componentPinBusNames) {
    for (const busName of busNames) {
      const isPower = powerBuses.some(b => b.name === busName);
      const isGround = groundBuses.some(b => b.name === busName);
      if (isPower) pinsWithPower++;
      if (isGround) pinsWithGround++;
      }
    }
  console.log(`[Netlist-NodeID] Found ${pinsWithPower} component pin(s) connected to power buses, ${pinsWithGround} connected to ground buses`)
  
  // Build component map
  // CRITICAL: Use full designator (e.g., "R1", "C2", "U3") to uniquely identify components
  // Abbreviation is just the first letter and should not be used for identification
  const componentMap = new Map<string, PCBComponent>();
  for (const comp of components) {
    const designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
    if (designator) {
      componentMap.set(designator, comp);
    }
  }
  
  // Helper function to infer pin type from pin name
  const inferPinType = (pinName: string): string => {
    if (!pinName || pinName.trim() === '') return 'unknown';
    const upperName = pinName.toUpperCase().trim();
    // Power pins
    if (upperName === 'VCC' || upperName === 'VDD' || upperName.startsWith('VCC') || upperName.startsWith('VDD') || 
        upperName === 'V+' || upperName.startsWith('V+') || upperName === 'VP' || upperName === 'VPOS') {
      return 'power';
    }
    // Ground pins
    if (upperName === 'GND' || upperName === 'VSS' || upperName === 'V-' || upperName.startsWith('V-') || 
        upperName === 'VN' || upperName === 'VNEG' || upperName === 'GROUND') {
      return 'ground';
    }
    // Input pins (common patterns)
    if (upperName.startsWith('IN') || upperName.startsWith('INPUT') || upperName.includes('IN+') || 
        upperName.includes('IN-') || upperName === 'A' || upperName === 'B' || upperName.startsWith('CLK') ||
        upperName.startsWith('EN') || upperName.startsWith('CS') || upperName.startsWith('CE')) {
      return 'input';
    }
    // Output pins (common patterns)
    if (upperName.startsWith('OUT') || upperName.startsWith('OUTPUT') || upperName.includes('OUT+') || 
        upperName.includes('OUT-') || upperName === 'Y' || upperName === 'Q' || upperName.startsWith('DO')) {
      return 'output';
    }
    // Default to unknown if we can't determine
    return 'unknown';
  };
  
  // Build components array
  const padsComponents: Array<{
    designator: string;
    part_number?: string;
    value?: string;
    package: string;
    pins: Array<{
      number: string;
      name: string;
      type: string;
    }>;
  }> = [];
  
  // Sort designators for consistent output
  const sortedDesignators = Array.from(componentMap.keys()).sort();
  
  for (const designator of sortedDesignators) {
    const comp = componentMap.get(designator)!;
    
    // Get part number (preferred for ICs)
    const partNumber = (comp as any).partNumber?.trim() || '';
    
    // Get component value (for passive components)
    let value = '';
    if (comp.componentType === 'Resistor' && 'resistance' in comp) {
      const { value: val, unit } = readValueAndUnit(comp, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
      value = val && val.trim() !== '' ? combineValueAndUnit(val, unit) : '';
    } else if ((comp.componentType === 'Capacitor' || comp.componentType === 'Electrolytic Capacitor' || comp.componentType === 'Film Capacitor') && 'capacitance' in comp) {
      const { value: val, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
      value = val && val.trim() !== '' ? combineValueAndUnit(val, unit) : '';
    } else if (comp.componentType === 'Inductor' && 'inductance' in comp) {
      const { value: val, unit } = readValueAndUnit(comp, 'inductance', 'inductanceUnit', getDefaultUnit('inductance'));
      value = val && val.trim() !== '' ? combineValueAndUnit(val, unit) : '';
    } else if (!partNumber) {
      // For other components without part number, use part name or component type
      const partName = (comp as any).partName?.trim();
      value = partName || comp.componentType;
    }
    
    // Get package (footprint)
    const packageName = (comp as any).packageType?.trim() || (comp as any).package?.trim() || (comp as any).footprint?.trim() || '';
    
    // Get pin data (preferred) or pin names (legacy fallback)
    const pinData = (comp as any).pinData as Array<{ name: string; type?: string; alternate_functions?: string[] }> | undefined;
    const pinNames = (comp as any).pinNames as string[] | undefined;
    
    // Build pins array with number, name, and type
    const pinCount = comp.pinCount || 0;
    const pins: Array<{ number: string; name: string; type: string }> = [];
    for (let i = 0; i < pinCount; i++) {
      const pinNumber = String(i + 1);
      
      // Get pin name from pinData (preferred) or pinNames (legacy), or use pin number as fallback
      let pinName = pinNumber;
      if (pinData && i < pinData.length && pinData[i]?.name?.trim()) {
        pinName = pinData[i].name.trim();
      } else if (pinNames && i < pinNames.length && pinNames[i]?.trim()) {
        pinName = pinNames[i].trim();
      }
      
      // Get pin type from pinData (preferred) or infer from pin name (fallback)
      let pinType: string;
      const pinTypeFromData = pinData?.[i]?.type?.trim();
      if (pinTypeFromData && pinTypeFromData !== '') {
        pinType = pinTypeFromData;
      } else {
        pinType = inferPinType(pinName);
      }
      
      pins.push({
        number: pinNumber,
        name: pinName,
        type: pinType
      });
    }
    
    const componentEntry: {
      designator: string;
      part_number?: string;
      value?: string;
      package: string;
      pins: Array<{ number: string; name: string; type: string }>;
    } = {
      designator,
      package: packageName,
      pins
    };
    
    // Include part_number if available (for ICs)
    if (partNumber) {
      componentEntry.part_number = partNumber;
    }
    
    // Include value if available (for passive components or components without part number)
    if (value) {
      componentEntry.value = value;
    }
    
    padsComponents.push(componentEntry);
  }
  
  // Build nets array (includes power, ground, and signal nets)
  const padsNets: Array<{
    name: string;
    connections: Array<{
      component: string;
      pin_number: string;
      pin_name: string;
      pin_type?: string;
    }>;
  }> = [];
  
    // Process each net group (now using Node IDs as keys)
  for (const [rootNodeId, netNodes] of netGroups) {
    const netName = netNames.get(rootNodeId);
    if (!netName) continue;
    
    // Extract component pin connections
    // CRITICAL: Check for componentId and pinIndex properties, not just type === 'component_pin'
    // This ensures we find component pins even when they're merged with vias/pads/power/ground
    // (merged nodes share the same Node ID)
    // 
    // IMPORTANT: Component pins connected to power or ground nodes (either directly with same Node ID
    // or through traces) will be in the same net group and will be included here.
    const connections: Array<{
      component: string;
      pin_number: string;
      pin_name: string;
      pin_type?: string;
      power_bus?: string;
      ground_bus?: string;
    }> = [];
    
    // First pass: Identify power and ground bus names in this net
    // CRITICAL: Check for powerBusId/groundBusId properties, not just type
    // (merged via/power and via/ground nodes keep their original type but have bus ID properties)
    let netPowerBusName: string | undefined;
    let netGroundBusName: string | undefined;
    for (const node of netNodes) {
      if (node.powerBusId) {
        const powerBus = powerBuses.find(b => b.id === node.powerBusId);
        if (powerBus) {
          netPowerBusName = powerBus.name;
        }
      }
      if (node.groundBusId) {
        const groundBus = groundBuses.find(b => b.id === node.groundBusId);
        if (groundBus) {
          netGroundBusName = groundBus.name;
        }
      }
    }
    
    for (const node of netNodes) {
      // Check if this node represents a component pin (either directly or merged with via/pad/power/ground)
      // Component pins have componentId and pinIndex properties regardless of the node type
      // This includes component pins that are:
      // 1. Directly at the same coordinates as power/ground nodes (merged nodes)
      // 2. Connected to power/ground nodes through traces (in the same net group)
      if (node.componentId && node.pinIndex !== undefined) {
        const comp = components.find(c => c.id === node.componentId);
        if (comp) {
          // CRITICAL: Use full designator (e.g., "R1", "C2", "U3") to uniquely identify components
          // Abbreviation is just the first letter and should not be used for identification
          const designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
          if (designator) {
            const pinNumber = String(node.pinIndex + 1); // Convert 0-based to 1-based
            // Get pin data from component's pinData (preferred) or pinNames (legacy), or use pin number as fallback
            const pinData = (comp as any).pinData as Array<{ name: string; type?: string; alternate_functions?: string[] }> | undefined;
            const pinNames = (comp as any).pinNames as string[] | undefined;
            
            // Get pin name
            let pinName = pinNumber; // Default fallback
            if (pinData && node.pinIndex < pinData.length && pinData[node.pinIndex]?.name?.trim()) {
              pinName = pinData[node.pinIndex].name.trim();
            } else if (pinNames && node.pinIndex < pinNames.length && pinNames[node.pinIndex]?.trim()) {
              pinName = pinNames[node.pinIndex].trim();
            }
            
            // Get pin type (if available)
            let pinType: string | undefined;
            const pinTypeFromData = pinData?.[node.pinIndex]?.type?.trim();
            if (pinTypeFromData && pinTypeFromData !== '') {
              pinType = pinTypeFromData;
            }
            
            const connection: {
              component: string;
              pin_number: string;
              pin_name: string;
              pin_type?: string;
              power_bus?: string;
              ground_bus?: string;
            } = {
              component: designator,
              pin_number: pinNumber,
              pin_name: pinName
            };
            
            // Only include pin_type if it's available
            if (pinType) {
              connection.pin_type = pinType;
            }
            
            // Add power/ground bus names if this pin is connected to a bus
            const pinKey = `${comp.id}:${node.pinIndex}`;
            const busNames = componentPinBusNames.get(pinKey);
            if (busNames && busNames.size > 0) {
              // Find power and ground buses (a pin could theoretically be connected to multiple buses)
              for (const busName of busNames) {
                const powerBus = powerBuses.find(b => b.name === busName);
                const groundBus = groundBuses.find(b => b.name === busName);
                if (powerBus && !connection.power_bus) {
                  // Only set if not already set (take first power bus found)
                  connection.power_bus = busName;
                } else if (groundBus && !connection.ground_bus) {
                  // Only set if not already set (take first ground bus found)
                  connection.ground_bus = busName;
                }
              }
            }
            
            // CRITICAL: Also check if this node is directly merged with a power/ground node at the same coordinates
            // This handles the case where a connector pin is directly at the same coordinates as a power/ground node
            // The node will have both componentId/pinIndex AND powerBusId/groundBusId properties
            if (!connection.power_bus && node.powerBusId) {
              const powerBus = powerBuses.find(b => b.id === node.powerBusId);
              if (powerBus) {
                connection.power_bus = powerBus.name;
              }
            }
            if (!connection.ground_bus && node.groundBusId) {
              const groundBus = groundBuses.find(b => b.id === node.groundBusId);
              if (groundBus) {
                connection.ground_bus = groundBus.name;
              }
            }
            
            // Also check if this net contains power/ground nodes (for indirect connections)
            if (!connection.power_bus && netPowerBusName) {
              connection.power_bus = netPowerBusName;
            }
            if (!connection.ground_bus && netGroundBusName) {
              connection.ground_bus = netGroundBusName;
            }
            
            connections.push(connection);
          }
        }
      }
    }
    
    // Include nets that have component connections OR are power/ground nets
    // Power and ground nets should be included even if they don't have component pins yet,
    // as they represent important power distribution nodes
    const isPowerNet = netName.startsWith('+') || netName.startsWith('-');
    const isGroundNet = netName === 'GND' || netName.toUpperCase().includes('GROUND');
    
    if (connections.length > 0 || isPowerNet || isGroundNet) {
      padsNets.push({
        name: netName,
        connections
      });
    }
  }
  
  // CRITICAL: Merge nets with the same name (standard industry practice)
  // Multiple net groups might have the same name (e.g., "GND") if they weren't
  // connected by traces. They should be merged into a single net.
  const mergedNetsMap = new Map<string, {
    name: string;
    connections: Array<{
      component: string;
      pin_number: string;
      pin_name: string;
      pin_type?: string;
      power_bus?: string;
      ground_bus?: string;
    }>;
  }>();
  
  for (const net of padsNets) {
    if (mergedNetsMap.has(net.name)) {
      // Merge connections into existing net
      const existingNet = mergedNetsMap.get(net.name)!;
      // Add connections, avoiding duplicates (same component + pin_number)
      for (const conn of net.connections) {
        const isDuplicate = existingNet.connections.some(
          existing => existing.component === conn.component && existing.pin_number === conn.pin_number
        );
        if (!isDuplicate) {
          existingNet.connections.push(conn);
        }
      }
    } else {
      // Create new net entry
      mergedNetsMap.set(net.name, {
        name: net.name,
        connections: [...net.connections]
      });
    }
  }
  
  // Convert back to array
  const mergedNets = Array.from(mergedNetsMap.values());
  
  // Log if any nets were merged
  if (mergedNets.length < padsNets.length) {
    console.log(`[Netlist-NodeID] Merged ${padsNets.length - mergedNets.length} duplicate net(s) with same name`);
  }
  
  // Sort nets: GND first, then power nets (by voltage), then signal nets
  mergedNets.sort((a, b) => {
    // Sort GND first
    if (a.name === 'GND') return -1;
    if (b.name === 'GND') return 1;
    
    // Sort power nets (starting with + or -) before signal nets
    const aIsPower = a.name.startsWith('+') || a.name.startsWith('-');
    const bIsPower = b.name.startsWith('+') || b.name.startsWith('-');
    if (aIsPower && !bIsPower) return -1;
    if (!aIsPower && bIsPower) return 1;
    
    // If both are power nets, sort by voltage (higher first)
    if (aIsPower && bIsPower) {
      const aVolt = parseFloat(a.name.replace(/[^0-9.-]/g, '')) || 0;
      const bVolt = parseFloat(b.name.replace(/[^0-9.-]/g, '')) || 0;
      if (bVolt !== aVolt) return bVolt - aVolt;
    }
    
    // Otherwise sort alphabetically
    return a.name.localeCompare(b.name);
  });
  
  // Build JSON structure
  const padsData = {
    design_info: {
      name: projectName || 'reversed_pcb',
      date: new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
    },
    components: padsComponents,
    nets: mergedNets
  };
  
  // Return formatted JSON string
  return JSON.stringify(padsData, null, 2);
}

/**
 * Generate net names based on node types
 * NOTE: Check for groundBusId/powerBusId properties, NOT just type === 'ground'/'power'
 * When a power/ground node and via/pad share the same coordinates, they get merged.
 * The merged node keeps type 'via' or 'pad' but has groundBusId/powerBusId/voltage set.
 */
export function generateNetNames(
  netGroups: Map<number, NetlistNode[]>,
  _nodes: Map<number, NetlistNode>
): Map<number, string> {
  const netNames = new Map<number, string>();
  let signalNetCounter = 1;
  
  for (const [root, netNodes] of netGroups) {
    // Check for ground nodes (includes merged via/ground nodes with groundBusId)
    // CRITICAL: Vias and pads that share the same Node ID with ground nodes
    // are in the same net, so this net should be labeled as GND
    const hasGround = netNodes.some(n => n.type === 'ground' || n.groundBusId);
    if (hasGround) {
      netNames.set(root, 'GND');
      console.log(`[NetNames] Net ${root}: Labeled as GND (contains ${netNodes.filter(n => n.type === 'ground' || n.groundBusId).length} ground node(s), ${netNodes.filter(n => n.type === 'via' || n.type === 'pad').length} via/pad node(s) sharing same Node ID)`);
      continue;
    }
    
    // Check for power nodes (includes merged via/power nodes with powerBusId/voltage)
    // CRITICAL: Vias and pads that share the same Node ID with power nodes
    // are in the same net, so this net should be labeled with the power bus voltage
    const powerNodes = netNodes.filter(n => n.type === 'power' || n.powerBusId || n.voltage);
    if (powerNodes.length > 0) {
      // Use the voltage from the first power node
      // All power nodes in the same net should have the same voltage (grouped by voltage)
      const voltage = powerNodes[0].voltage || 'UNKNOWN';
      // Format voltage to KiCad standard notation (+5V, -3V3, etc.)
      const cleanVoltage = normalizeVoltage(voltage);
      netNames.set(root, cleanVoltage);
      const viaPadCount = netNodes.filter(n => n.type === 'via' || n.type === 'pad').length;
      console.log(`[NetNames] Net ${root}: Labeled as ${cleanVoltage} (contains ${powerNodes.length} power node(s), ${viaPadCount} via/pad node(s) sharing same Node ID)`);
      continue;
    }
    
    // Signal nets: sequential names
    netNames.set(root, `N$${signalNetCounter++}`);
  }
  
  return netNames;
}
