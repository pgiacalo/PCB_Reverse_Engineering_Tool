# Trace System and Connectivity Analysis

## Overview

This document describes how traces are created, stored, and analyzed for netlist generation in the PCB Reverse Engineering Tool.

## Trace Creation Workflow

### User Interaction

1. **Select Trace Tool**: User clicks the "Draw Traces" tool
2. **Start Trace**: User clicks on image to establish starting point
   - Typically at a via or pad location
   - Automatically snaps to nearest via/pad within 10 pixels
   - Hold Shift to override snapping
3. **Follow Path**: User clicks along the trace path
   - Each click creates a point in the trace
   - Points may be at vias, pads, or arbitrary locations
   - Snapping applies to each click (within 10 pixels)
4. **End Trace**: User finalizes the trace
   - Press **Escape** key, or
   - Press **Return** key, or
   - Double-click, or
   - Click outside drawing area
   - End point typically at a via or pad

### Snapping Behavior

```typescript
// From user specification:
// - Snap to nearest via/pad if within 10 pixels
// - Override snapping by holding Shift key

function handleTraceClick(x: number, y: number, isShiftHeld: boolean) {
  let finalPoint: Point;
  
  if (isShiftHeld) {
    // No snapping - use exact click location
    finalPoint = { x, y };
  } else {
    // Snap to nearest via/pad within 10 pixels
    finalPoint = snapToNearestNode(x, y, 10);
  }
  
  // Add point to current trace
  addPointToTrace(finalPoint);
}
```

## Current Data Structure

### DrawingStroke (Current Implementation)

```typescript
interface DrawingStroke {
  id: string;                    // Unique trace ID (e.g., "trace-1234567890-abc")
  points: DrawingPoint[];        // Ordered array of points defining the trace path
  color: string;                 // Display color
  size: number;                  // Line width
  layer: 'top' | 'bottom';       // PCB layer
  type?: 'trace' | 'via';        // Type of drawing
}

interface DrawingPoint {
  id: number;                    // Sequential point ID (1, 2, 3, ...)
  x: number;                     // X coordinate
  y: number;                     // Y coordinate
}
```

### Example Trace

```typescript
{
  id: "trace-1699876543210-abc123",
  layer: "top",
  color: "#ff0000",
  size: 2,
  type: "trace",
  points: [
    { id: 1, x: 100, y: 200 },   // Start point (snapped to via)
    { id: 2, x: 150, y: 200 },   // Intermediate point
    { id: 3, x: 150, y: 250 },   // Corner point
    { id: 4, x: 200, y: 250 },   // Intermediate point
    { id: 5, x: 250, y: 250 },   // End point (snapped to via)
  ]
}
```

## Trace Storage Requirements

### ✅ Current System Meets All Requirements

The current `DrawingStroke` structure already provides:

1. **Persistence**: Trace ID and all points are saved/loaded
2. **Ordered Points**: Points array maintains sequence
3. **Redrawing**: Points can be rendered as polyline
4. **Editing**: Individual points can be modified
5. **Deletion**: Entire trace can be removed by ID
6. **Layer Separation**: Top and bottom traces are separate

### Storage in Application State

```typescript
// Separate arrays for top and bottom layer traces
const [tracesTop, setTracesTop] = useState<DrawingStroke[]>([]);
const [tracesBottom, setTracesBottom] = useState<DrawingStroke[]>([]);
```

## Connectivity Analysis for Netlist Generation

### Challenge: Determine Which Nodes a Trace Connects

A trace is a **polyline** (series of connected line segments). We need to find which vias, pads, power nodes, and ground nodes it connects.

### Solution: Geometric Intersection Analysis

```typescript
/**
 * Find all nodes that a trace connects
 * A node is "connected" if the trace passes through or very close to it
 */
function findNodesConnectedByTrace(
  trace: DrawingStroke,
  vias: Via[],
  grounds: GroundSymbol[],
  powerNodes: PowerNode[],
  components: PCBComponent[],
  tolerance: number = 5  // pixels
): string[] {
  const connectedNodeIds: string[] = [];
  
  // Check each via
  for (const via of vias) {
    if (traceIntersectsNode(trace, via.x, via.y, via.size / 2, tolerance)) {
      connectedNodeIds.push(via.id);
    }
  }
  
  // Check each ground symbol
  for (const ground of grounds) {
    if (traceIntersectsNode(trace, ground.x, ground.y, ground.size / 2, tolerance)) {
      connectedNodeIds.push(ground.id);
    }
  }
  
  // Check each power node
  for (const power of powerNodes) {
    if (traceIntersectsNode(trace, power.x, power.y, power.size / 2, tolerance)) {
      connectedNodeIds.push(power.id);
    }
  }
  
  // Check component pads (if we add pad support)
  // ... similar logic for pads
  
  return connectedNodeIds;
}
```

### Geometric Intersection Test

```typescript
/**
 * Check if a trace (polyline) passes through or near a node (point)
 */
function traceIntersectsNode(
  trace: DrawingStroke,
  nodeX: number,
  nodeY: number,
  nodeRadius: number,
  tolerance: number
): boolean {
  const threshold = nodeRadius + tolerance + trace.size / 2;
  
  // Check each point in the trace
  for (const point of trace.points) {
    const dist = distance({ x: point.x, y: point.y }, { x: nodeX, y: nodeY });
    if (dist <= threshold) {
      return true;
    }
  }
  
  // Check each line segment in the trace
  for (let i = 0; i < trace.points.length - 1; i++) {
    const p1 = trace.points[i];
    const p2 = trace.points[i + 1];
    const dist = distanceToSegment(
      { x: nodeX, y: nodeY },
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p2.y }
    );
    if (dist <= threshold) {
      return true;
    }
  }
  
  return false;
}
```

## Enhanced Trace Data Structure (Proposed)

### Option 1: Add Metadata to DrawingStroke (Recommended)

```typescript
interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via';
  
  // NEW: Connectivity metadata (computed during analysis)
  connectedNodeIds?: string[];   // IDs of nodes this trace connects
  netId?: string;                // Assigned net ID (after net analysis)
  netName?: string;              // Assigned net name (e.g., "GND", "+5V", "N$1")
}
```

**Advantages:**
- Minimal changes to existing structure
- Metadata can be computed on-demand
- Easy to serialize/deserialize
- Backward compatible

### Option 2: Separate Connectivity Graph (Alternative)

Keep `DrawingStroke` as-is, maintain separate connectivity data:

```typescript
interface TraceConnectivity {
  traceId: string;
  connectedNodeIds: string[];
  netId?: string;
  netName?: string;
}

// Separate map of trace connectivity
const traceConnectivity = new Map<string, TraceConnectivity>();
```

**Advantages:**
- Cleaner separation of concerns
- Drawing data separate from analysis data
- Can recompute connectivity without modifying traces

**Recommendation:** Use **Option 1** for simplicity and ease of serialization.

## Trace Navigation for Net Analysis

### Building the Connectivity Graph

```typescript
interface ConnectivityGraph {
  nodes: Map<string, Node>;           // All nodes (vias, pads, power, ground)
  traces: Map<string, TraceInfo>;     // All traces with connectivity
  nets: Map<string, Net>;             // All nets (computed)
}

interface TraceInfo {
  id: string;
  layer: 'top' | 'bottom';
  connectedNodeIds: string[];         // Nodes this trace connects
}

interface Node {
  id: string;
  type: 'via' | 'power' | 'ground' | 'component_pin' | 'pad';
  x: number;
  y: number;
  layer?: 'top' | 'bottom';
  
  // For component pins
  componentId?: string;
  pinIndex?: number;
  
  // For power nodes
  voltage?: string;
}

interface Net {
  id: string;
  name: string;                       // "GND", "+5V", "SIGNAL_1", etc.
  type: 'signal' | 'power' | 'ground';
  nodeIds: string[];                  // All nodes in this net
  traceIds: string[];                 // All traces in this net
}
```

### Algorithm: Build Connectivity Graph

```typescript
function buildConnectivityGraph(
  tracesTop: DrawingStroke[],
  tracesBottom: DrawingStroke[],
  vias: Via[],
  grounds: GroundSymbol[],
  powerNodes: PowerNode[],
  componentsTop: PCBComponent[],
  componentsBottom: PCBComponent[]
): ConnectivityGraph {
  const graph: ConnectivityGraph = {
    nodes: new Map(),
    traces: new Map(),
    nets: new Map(),
  };
  
  // Step 1: Add all nodes to the graph
  
  // Add vias (connect both layers)
  for (const via of vias) {
    graph.nodes.set(via.id, {
      id: via.id,
      type: 'via',
      x: via.x,
      y: via.y,
    });
  }
  
  // Add ground nodes
  for (const ground of grounds) {
    graph.nodes.set(ground.id, {
      id: ground.id,
      type: 'ground',
      x: ground.x,
      y: ground.y,
    });
  }
  
  // Add power nodes
  for (const power of powerNodes) {
    graph.nodes.set(power.id, {
      id: power.id,
      type: 'power',
      x: power.x,
      y: power.y,
      voltage: power.voltage,
    });
  }
  
  // Add component pins as virtual nodes
  const allComponents = [...componentsTop, ...componentsBottom];
  for (const comp of allComponents) {
    for (let i = 0; i < comp.pinCount; i++) {
      const nodeId = comp.pinConnections[i];
      if (nodeId === '') continue;
      
      // Create virtual node for this pin
      const pinNodeId = `${comp.id}-pin${i}`;
      graph.nodes.set(pinNodeId, {
        id: pinNodeId,
        type: 'component_pin',
        x: comp.x,
        y: comp.y,
        layer: comp.layer,
        componentId: comp.id,
        pinIndex: i,
      });
    }
  }
  
  // Step 2: Analyze each trace to find connected nodes
  
  const allTraces = [
    ...tracesTop.map(t => ({ ...t, layer: 'top' as const })),
    ...tracesBottom.map(t => ({ ...t, layer: 'bottom' as const })),
  ];
  
  for (const trace of allTraces) {
    const connectedNodeIds = findNodesConnectedByTrace(
      trace,
      vias,
      grounds,
      powerNodes,
      allComponents
    );
    
    graph.traces.set(trace.id, {
      id: trace.id,
      layer: trace.layer,
      connectedNodeIds,
    });
  }
  
  // Step 3: Build nets using union-find algorithm
  graph.nets = assignNets(graph.nodes, graph.traces);
  
  return graph;
}
```

### Algorithm: Assign Nets (Union-Find)

```typescript
function assignNets(
  nodes: Map<string, Node>,
  traces: Map<string, TraceInfo>
): Map<string, Net> {
  const nets = new Map<string, Net>();
  const nodeToNet = new Map<string, string>();  // Node ID → Net ID
  
  // Union-Find data structure
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  
  // Initialize: each node is its own parent
  for (const nodeId of nodes.keys()) {
    parent.set(nodeId, nodeId);
    rank.set(nodeId, 0);
  }
  
  // Find with path compression
  function find(nodeId: string): string {
    if (parent.get(nodeId) !== nodeId) {
      parent.set(nodeId, find(parent.get(nodeId)!));
    }
    return parent.get(nodeId)!;
  }
  
  // Union by rank
  function union(nodeId1: string, nodeId2: string): void {
    const root1 = find(nodeId1);
    const root2 = find(nodeId2);
    
    if (root1 === root2) return;
    
    const rank1 = rank.get(root1) || 0;
    const rank2 = rank.get(root2) || 0;
    
    if (rank1 < rank2) {
      parent.set(root1, root2);
    } else if (rank1 > rank2) {
      parent.set(root2, root1);
    } else {
      parent.set(root2, root1);
      rank.set(root1, rank1 + 1);
    }
  }
  
  // Process each trace: union all nodes it connects
  for (const trace of traces.values()) {
    const nodeIds = trace.connectedNodeIds;
    if (nodeIds.length < 2) continue;
    
    // Union all pairs of nodes connected by this trace
    for (let i = 0; i < nodeIds.length - 1; i++) {
      union(nodeIds[i], nodeIds[i + 1]);
    }
  }
  
  // Group nodes by their root (net)
  const netGroups = new Map<string, string[]>();
  for (const nodeId of nodes.keys()) {
    const root = find(nodeId);
    if (!netGroups.has(root)) {
      netGroups.set(root, []);
    }
    netGroups.get(root)!.push(nodeId);
  }
  
  // Create Net objects
  let netCounter = 1;
  for (const [root, nodeIds] of netGroups) {
    const netId = generateUniqueId('net');
    const netName = generateNetName(nodeIds, nodes, netCounter++);
    const netType = determineNetType(nodeIds, nodes);
    
    // Find all traces that connect nodes in this net
    const traceIds: string[] = [];
    for (const [traceId, trace] of traces) {
      const traceConnectsNet = trace.connectedNodeIds.some(id => 
        nodeIds.includes(id)
      );
      if (traceConnectsNet) {
        traceIds.push(traceId);
      }
    }
    
    nets.set(netId, {
      id: netId,
      name: netName,
      type: netType,
      nodeIds,
      traceIds,
    });
  }
  
  return nets;
}
```

### Net Naming Logic

```typescript
function generateNetName(
  nodeIds: string[],
  nodes: Map<string, Node>,
  counter: number
): string {
  // Check if any node is ground
  for (const nodeId of nodeIds) {
    const node = nodes.get(nodeId);
    if (node?.type === 'ground') {
      return 'GND';
    }
  }
  
  // Check if any node is power
  for (const nodeId of nodeIds) {
    const node = nodes.get(nodeId);
    if (node?.type === 'power') {
      return node.voltage || '+VCC';
    }
  }
  
  // Signal net - use sequential naming
  return `N$${counter}`;
}

function determineNetType(
  nodeIds: string[],
  nodes: Map<string, Node>
): 'signal' | 'power' | 'ground' {
  for (const nodeId of nodeIds) {
    const node = nodes.get(nodeId);
    if (node?.type === 'ground') return 'ground';
    if (node?.type === 'power') return 'power';
  }
  return 'signal';
}
```

## Example: Complete Trace Analysis

### Input Data

```typescript
// Trace connecting Via-1 → Via-2 → Via-3
const trace1: DrawingStroke = {
  id: "trace-001",
  layer: "top",
  points: [
    { id: 1, x: 100, y: 100 },  // At Via-1
    { id: 2, x: 150, y: 100 },  // Midpoint
    { id: 3, x: 200, y: 100 },  // At Via-2
    { id: 4, x: 200, y: 150 },  // Midpoint
    { id: 5, x: 200, y: 200 },  // At Via-3
  ],
  color: "#ff0000",
  size: 2,
};

const vias: Via[] = [
  { id: "via-1", x: 100, y: 100, size: 10, color: "#000" },
  { id: "via-2", x: 200, y: 100, size: 10, color: "#000" },
  { id: "via-3", x: 200, y: 200, size: 10, color: "#000" },
];

// Component U1 Pin 1 connected to Via-1
// Component U1 Pin 2 connected to Via-3
const component: PCBComponent = {
  id: "comp-1",
  designator: "U1",
  componentType: "IntegratedCircuit",
  pinCount: 8,
  pinConnections: [
    "via-1",  // Pin 1
    "",       // Pin 2 (unconnected)
    "via-3",  // Pin 3
    // ... other pins
  ],
  // ... other properties
};
```

### Analysis Result

```typescript
// Trace connectivity
{
  traceId: "trace-001",
  connectedNodeIds: ["via-1", "via-2", "via-3"]
}

// Net assignment
{
  netId: "net-001",
  name: "N$1",
  type: "signal",
  nodeIds: [
    "via-1",
    "via-2",
    "via-3",
    "comp-1-pin0",  // U1 Pin 1
    "comp-1-pin2",  // U1 Pin 3
  ],
  traceIds: ["trace-001"]
}
```

### KiCad Netlist Output

```
(net (code 1) (name N$1)
  (node (ref U1) (pin 1))
  (node (ref U1) (pin 3))
)
```

## Implementation Files

### Existing Files (No Changes Needed)
- `src/types/index.ts` - DrawingStroke and DrawingPoint already defined ✅
- `src/utils/coordinates.ts` - ID generation and geometric utilities ✅

### New Files to Create
- `src/utils/netlist.ts` - Connectivity analysis and net assignment
- `src/utils/traceAnalysis.ts` - Trace-to-node intersection detection

## Summary

### ✅ Current Trace System is Well-Designed

The existing `DrawingStroke` structure with ordered `DrawingPoint[]` array:
- **Persists** all trace information for save/load
- **Maintains** point sequence for redrawing
- **Supports** editing and deletion
- **Enables** connectivity analysis through geometric intersection

### Next Steps for Netlist Generation

1. **Implement `findNodesConnectedByTrace()`** - Geometric intersection analysis
2. **Implement `buildConnectivityGraph()`** - Build complete connectivity graph
3. **Implement `assignNets()`** - Union-find algorithm for net assignment
4. **Add connectivity metadata** to `DrawingStroke` (optional)
5. **Export KiCad netlist** using connectivity graph

The trace system is ready for netlist generation! 🎉

