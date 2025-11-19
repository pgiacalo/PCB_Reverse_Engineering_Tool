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
        Object.assign(existing, extraData);
        // Preserve component_pin type if it exists
        if (extraData.type === 'component_pin' || existing.type === 'component_pin') {
          existing.type = 'component_pin';
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
      pointIdToCoord.set(point.id, coordKey);
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
        pointIdToCoord.set(point.id, coordKey);
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
    getOrCreateNode(ground.x, ground.y, 'ground');
    // Note: GroundSymbol may have pointId if added dynamically
    const groundWithPointId = ground as GroundSymbol & { pointId?: number };
    if (groundWithPointId.pointId !== undefined) {
      const coordKey = createCoordKey(ground.x, ground.y);
      pointIdToCoord.set(groundWithPointId.pointId, coordKey);
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
            // Point ID not found in drawingStrokes - pin is not actually connected
            unconnectedPins.push({
              compId: comp.id,
              designator,
              pinIndex: pinIndex,
              pointId: pinConnection.trim()
            });
            console.warn(`[Connectivity] Component ${designator} pin ${pinIndex + 1}: Point ID ${pointId} not found in drawingStrokes - pin is NOT connected`);
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
 * Group connected nodes into nets using union-find (coordinate-based)
 * CRITICAL: All ground points are connected by definition.
 * CRITICAL: All power points with the same voltage and sign are connected by definition.
 */
export function groupNodesIntoNetsCoordinateBased(
  coordinateToNode: Map<string, NetlistNode>,
  connections: Array<[string, string]>
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
  
  // CRITICAL: Union all ground nodes together (all ground points are connected by definition)
  const groundCoordKeys: string[] = [];
  for (const [coordKey, node] of coordinateToNode) {
    if (node.type === 'ground') {
      groundCoordKeys.push(coordKey);
      getIntId(coordKey); // Ensure it's in the union-find structure
    }
  }
  // Union all ground nodes with each other
  if (groundCoordKeys.length > 1) {
    const firstGroundId = getIntId(groundCoordKeys[0]);
    for (let i = 1; i < groundCoordKeys.length; i++) {
      const otherGroundId = getIntId(groundCoordKeys[i]);
      uf.union(firstGroundId, otherGroundId);
    }
    console.log(`[Connectivity] Unified ${groundCoordKeys.length} ground nodes into a single net`);
  }
  
  // CRITICAL: Union all power nodes with the same voltage and sign together
  // Group power nodes by voltage (voltage string must match exactly, including sign)
  const powerNodesByVoltage = new Map<string, string[]>();
  for (const [coordKey, node] of coordinateToNode) {
    if (node.type === 'power' && node.voltage) {
      const voltage = node.voltage.trim();
      if (!powerNodesByVoltage.has(voltage)) {
        powerNodesByVoltage.set(voltage, []);
      }
      powerNodesByVoltage.get(voltage)!.push(coordKey);
      getIntId(coordKey); // Ensure it's in the union-find structure
    }
  }
  // Union all power nodes with the same voltage
  for (const [voltage, coordKeys] of powerNodesByVoltage) {
    if (coordKeys.length > 1) {
      const firstPowerId = getIntId(coordKeys[0]);
      for (let i = 1; i < coordKeys.length; i++) {
        const otherPowerId = getIntId(coordKeys[i]);
        uf.union(firstPowerId, otherPowerId);
      }
      console.log(`[Connectivity] Unified ${coordKeys.length} power nodes with voltage "${voltage}" into a single net`);
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
 * Build connectivity graph from PCB elements (ORIGINAL Point ID-based method)
 */
export function buildConnectivityGraph(
  drawingStrokes: DrawingStroke[],
  components: PCBComponent[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): Map<number, NetlistNode> {
  const nodes = new Map<number, NetlistNode>();
  
  // Add nodes from drawing strokes (traces, vias, and pads)
  for (const stroke of drawingStrokes) {
    if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
      const point = stroke.points[0];
      if (point.id !== undefined && !nodes.has(point.id)) {
        nodes.set(point.id, {
          id: point.id,
          type: stroke.type === 'via' ? 'via' : 'pad',
          x: point.x,
          y: point.y,
        });
      }
    } else if (stroke.type === 'trace') {
      // Add all points in the trace
      for (const point of stroke.points) {
        if (point.id !== undefined && !nodes.has(point.id)) {
          nodes.set(point.id, {
            id: point.id,
            type: 'trace_point',
            x: point.x,
            y: point.y,
          });
        }
      }
    }
  }
  
  // Add power nodes
  for (const power of powerSymbols) {
    if (power.pointId !== undefined) {
      const bus = powerBuses.find(b => b.id === power.powerBusId);
      nodes.set(power.pointId, {
        id: power.pointId,
        type: 'power',
        x: power.x,
        y: power.y,
        voltage: bus?.voltage || power.type || 'UNKNOWN',
        powerBusId: power.powerBusId,
      });
    }
  }
  
  // Add ground nodes
  for (const ground of groundSymbols) {
    // Note: GroundSymbol may have pointId if added dynamically
    const groundWithPointId = ground as GroundSymbol & { pointId?: number };
    if (groundWithPointId.pointId !== undefined) {
      nodes.set(groundWithPointId.pointId, {
        id: groundWithPointId.pointId,
        type: 'ground',
        x: ground.x,
        y: ground.y,
      });
    }
  }
  
  // Add component pin nodes
  // IMPORTANT: Component pins reference point IDs that may already exist as vias, trace points, etc.
  // When a component pin references a point ID, we need to ensure that node is marked as a component pin
  // but preserve its connection to other nodes through traces
  for (const comp of components) {
    // Get the actual designator (abbreviation takes precedence)
    const actualDesignator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (!actualDesignator) continue; // Skip components without designators
    
    for (let pinIndex = 0; pinIndex < comp.pinCount; pinIndex++) {
      const nodeIdStr = comp.pinConnections?.[pinIndex] || '';
      if (nodeIdStr && nodeIdStr.trim() !== '') {
        const nodeId = parseInt(nodeIdStr.trim(), 10);
        if (!isNaN(nodeId) && nodeId > 0) {
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
          } else {
            // Update existing node to mark it as a component pin
            // This handles the case where a component pin is connected to a via or trace point
            const node = nodes.get(nodeId)!;
            // Preserve the original type if it's important, but mark as component pin
            // Actually, for netlist output, we need to know it's a component pin
            node.componentId = comp.id;
            node.pinIndex = pinIndex;
            // Keep the type as component_pin for output purposes
            // But the node is still connected to other nodes through its point ID
            node.type = 'component_pin';
          }
        }
      }
    }
  }
  
  return nodes;
}

/**
 * Build connections from drawing strokes (traces connect points, vias are single points)
 * Also includes connections from component pins, power, and ground nodes that share point IDs
 */
// @ts-ignore - Reserved for future use
function buildConnections(
  drawingStrokes: DrawingStroke[],
  _nodes: Map<number, NetlistNode>
): Array<[number, number]> {
  const connections: Array<[number, number]> = [];
  
  // Build connections from traces (connect consecutive points)
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      // Connect consecutive points in the trace
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        if (point1 && point2) {
          connections.push([point1.id, point2.id]);
        }
      }
    }
    // Vias are single points - they connect to traces through shared point IDs
    // If a trace point has the same ID as a via, they're automatically the same node
  }
  
  // All nodes with the same point ID are automatically connected
  // This handles:
  // - Component pins connected to vias (same point ID)
  // - Component pins connected to trace points (same point ID)
  // - Power/ground nodes connected to vias/traces (same point ID)
  // The union-find algorithm will group all nodes with the same ID together
  
  return connections;
}

/**
 * Group connected nodes into nets using union-find
 * Note: Nodes with the same point ID are already the same node (same key in the map)
 * This function groups nodes that are connected through traces
 * CRITICAL: All ground points are connected by definition.
 * CRITICAL: All power points with the same voltage and sign are connected by definition.
 */
export function groupNodesIntoNets(
  nodes: Map<number, NetlistNode>,
  connections: Array<[number, number]>
): Map<number, NetlistNode[]> {
  const uf = new UnionFind();
  
  // Union nodes connected by traces
  // Note: If a component pin, via, power, or ground node shares the same point ID,
  // they're already the same node in the map (same key), so no need to union them
  for (const [nodeId1, nodeId2] of connections) {
    if (nodes.has(nodeId1) && nodes.has(nodeId2)) {
      uf.union(nodeId1, nodeId2);
    }
  }
  
  // CRITICAL: Union all ground nodes together (all ground points are connected by definition)
  const groundNodeIds: number[] = [];
  for (const [nodeId, node] of nodes) {
    if (node.type === 'ground') {
      groundNodeIds.push(nodeId);
    }
  }
  // Union all ground nodes with each other
  if (groundNodeIds.length > 1) {
    const firstGroundId = groundNodeIds[0];
    for (let i = 1; i < groundNodeIds.length; i++) {
      uf.union(firstGroundId, groundNodeIds[i]);
    }
    console.log(`[Connectivity] Unified ${groundNodeIds.length} ground nodes into a single net`);
  }
  
  // CRITICAL: Union all power nodes with the same voltage and sign together
  // Group power nodes by voltage (voltage string must match exactly, including sign)
  const powerNodesByVoltage = new Map<string, number[]>();
  for (const [nodeId, node] of nodes) {
    if (node.type === 'power' && node.voltage) {
      const voltage = node.voltage.trim();
      if (!powerNodesByVoltage.has(voltage)) {
        powerNodesByVoltage.set(voltage, []);
      }
      powerNodesByVoltage.get(voltage)!.push(nodeId);
    }
  }
  // Union all power nodes with the same voltage
  for (const [voltage, nodeIds] of powerNodesByVoltage) {
    if (nodeIds.length > 1) {
      const firstPowerId = nodeIds[0];
      for (let i = 1; i < nodeIds.length; i++) {
        uf.union(firstPowerId, nodeIds[i]);
      }
      console.log(`[Connectivity] Unified ${nodeIds.length} power nodes with voltage "${voltage}" into a single net`);
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
 */
export function generateNetNamesCoordinateBased(
  netGroups: Map<string, NetlistNode[]>,
  _coordinateToNode: Map<string, NetlistNode>
): Map<string, string> {
  const netNames = new Map<string, string>();
  let signalNetCounter = 1;
  
  for (const [rootCoordKey, netNodes] of netGroups) {
    // Check for ground nodes
    const hasGround = netNodes.some(n => n.type === 'ground');
    if (hasGround) {
      netNames.set(rootCoordKey, 'GND');
      continue;
    }
    
    // Check for power nodes
    const powerNodes = netNodes.filter(n => n.type === 'power');
    if (powerNodes.length > 0) {
      // Use the voltage from the first power node
      const voltage = powerNodes[0].voltage || 'UNKNOWN';
      // Clean voltage string (remove spaces, ensure +/- prefix)
      let cleanVoltage = voltage.trim();
      if (cleanVoltage && !cleanVoltage.startsWith('+') && !cleanVoltage.startsWith('-') && !cleanVoltage.startsWith('AC')) {
        cleanVoltage = '+' + cleanVoltage;
      }
      netNames.set(rootCoordKey, cleanVoltage);
      continue;
    }
    
    // Signal nets: sequential names
    netNames.set(rootCoordKey, `N$${signalNetCounter++}`);
  }
  
  return netNames;
}

/**
 * Get component value for netlist (prioritizes partNumber, designator, then componentType)
 */
function getComponentValue(comp: PCBComponent): string {
  const partName = (comp as any).partName?.trim();
  if (partName) return partName;
  
  const partNumber = (comp as any).partNumber?.trim();
  if (partNumber) return partNumber;
  
  const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
  if (designator) return designator;
  
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
 * Generate net names based on node types
 */
export function generateNetNames(
  netGroups: Map<number, NetlistNode[]>,
  _nodes: Map<number, NetlistNode>
): Map<number, string> {
  const netNames = new Map<number, string>();
  let signalNetCounter = 1;
  
  for (const [root, netNodes] of netGroups) {
    // Check for ground nodes
    const hasGround = netNodes.some(n => n.type === 'ground');
    if (hasGround) {
      netNames.set(root, 'GND');
      continue;
    }
    
    // Check for power nodes
    const powerNodes = netNodes.filter(n => n.type === 'power');
    if (powerNodes.length > 0) {
      // Use the voltage from the first power node
      const voltage = powerNodes[0].voltage || 'UNKNOWN';
      // Clean voltage string (remove spaces, ensure +/- prefix)
      let cleanVoltage = voltage.trim();
      if (cleanVoltage && !cleanVoltage.startsWith('+') && !cleanVoltage.startsWith('-') && !cleanVoltage.startsWith('AC')) {
        cleanVoltage = '+' + cleanVoltage;
      }
      netNames.set(root, cleanVoltage);
      continue;
    }
    
    // Signal nets: sequential names
    netNames.set(root, `N$${signalNetCounter++}`);
  }
  
  return netNames;
}
