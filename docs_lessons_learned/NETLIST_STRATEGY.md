# Netlist Generation Strategy

## Overview

This document describes the ID system and netlist generation strategy for the PCB Reverse Engineering Tool. The goal is to generate a KiCad-compatible netlist that describes all electrical connections between components.

## Current ID System

### ✅ All PCB Elements Have Unique IDs

| Element Type | ID Type | ID Format | Example |
|--------------|---------|-----------|---------|
| **DrawingPoint** | `number` | Sequential integer | `1`, `2`, `3`, ... |
| **DrawingStroke** | `string` | UUID-like | `"stroke-1234567890-abc"` |
| **Via** | `string` | UUID-like | `"via-1234567890-abc"` |
| **TraceSegment** | `string` | UUID-like | `"trace-1234567890-abc"` |
| **PCBComponent** (all 24 types) | `string` | UUID-like | `"comp-1234567890-abc"` |
| **GroundSymbol** | `string` | UUID-like | `"gnd-1234567890-abc"` |
| **PowerNode** | `string` | UUID-like | `"pwr-1234567890-abc"` |

### ID Generation Functions

Located in `src/utils/coordinates.ts`:

```typescript
// Sequential integer IDs for drawing points
let nextPointId = 1;
export function generatePointId(): number {
  return nextPointId++;
}

// UUID-like string IDs for all other elements
export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
```

### ✅ Current System is Suitable for Netlist Generation

**Advantages:**
1. **Globally Unique**: Timestamp + random ensures no collisions
2. **Human-Readable**: Prefix indicates element type
3. **Persistent**: IDs remain stable across save/load
4. **Traceable**: Can track connections through the system
5. **KiCad Compatible**: String IDs work well in netlist format

## Netlist Concept: Nodes and Nets

### What is a Node?

A **node** is a point of electrical connection on the PCB. In our system, nodes are:

- **Vias**: Connect top and bottom layers
- **Power Nodes**: Connect to power planes (+5V, +3.3V, etc.)
- **Ground Nodes**: Connect to ground plane
- **Component Pins**: Connection points on components (via `pinConnections` array)

### What is a Net?

A **net** is a collection of nodes that are electrically connected. For example:
- All nodes connected by traces form a single net
- A net has a unique name (e.g., "GND", "+5V", "SIGNAL_1")
- Components reference nets through their pin connections

### Node vs. Net Example

```
Via-1 ----Trace---- Via-2 ----Trace---- U1.Pin3
  |                                        |
  +---- All part of NET "SIGNAL_1" -------+

Via-3 ----Trace---- Via-4 ----Trace---- U1.Pin4 ----Trace---- GND
  |                                        |                     |
  +---- All part of NET "GND" (ground net) --------------------+
```

## Recommended Netlist Strategy

### Phase 1: Node Identification (Current System) ✅

**Status**: Already implemented

All PCB elements have unique IDs:
- Vias: `via-1234567890-abc`
- Ground symbols: `gnd-1234567890-abc`
- Power nodes: `pwr-1234567890-abc`
- Components: `comp-1234567890-abc`
- Component pins: Referenced by component ID + pin index

### Phase 2: Connectivity Graph (To Be Implemented)

Build a graph of electrical connections:

```typescript
interface Connection {
  fromNodeId: string;  // Source node ID
  toNodeId: string;    // Destination node ID
  layer?: 'top' | 'bottom' | 'both';
}

interface ConnectivityGraph {
  nodes: Map<string, Node>;         // All nodes by ID
  connections: Connection[];        // All connections
  nets: Map<string, Net>;          // All nets by name
}

interface Node {
  id: string;                      // Unique node ID
  type: 'via' | 'power' | 'ground' | 'component_pin';
  x: number;
  y: number;
  netId?: string;                  // Assigned net ID (after analysis)
  
  // For component pins
  componentId?: string;
  pinIndex?: number;
  
  // For power nodes
  voltage?: string;                // e.g., "+5V", "+3.3V"
}

interface Net {
  id: string;                      // Unique net ID
  name: string;                    // Net name (e.g., "GND", "+5V", "N$1")
  nodes: string[];                 // Array of node IDs in this net
  type: 'signal' | 'power' | 'ground';
}
```

### Phase 3: Trace Analysis (To Be Implemented)

Analyze drawn traces to determine connectivity:

```typescript
function analyzeTraces(
  traces: DrawingStroke[],
  vias: Via[],
  grounds: GroundSymbol[],
  powerNodes: PowerNode[]
): Connection[] {
  const connections: Connection[] = [];
  
  for (const trace of traces) {
    // For each trace, find which nodes it connects
    const connectedNodes = findNodesAlongTrace(trace, vias, grounds, powerNodes);
    
    // Create connections between consecutive nodes
    for (let i = 0; i < connectedNodes.length - 1; i++) {
      connections.push({
        fromNodeId: connectedNodes[i],
        toNodeId: connectedNodes[i + 1],
        layer: trace.layer,
      });
    }
  }
  
  return connections;
}
```

### Phase 4: Net Assignment (To Be Implemented)

Use graph traversal to assign nets:

```typescript
function assignNets(
  nodes: Map<string, Node>,
  connections: Connection[]
): Map<string, Net> {
  const nets = new Map<string, Net>();
  const visited = new Set<string>();
  
  // Use union-find or BFS to group connected nodes into nets
  for (const [nodeId, node] of nodes) {
    if (visited.has(nodeId)) continue;
    
    // Find all nodes connected to this one
    const connectedNodeIds = findConnectedNodes(nodeId, connections);
    
    // Create a new net
    const netName = generateNetName(node, connectedNodeIds, nodes);
    const net: Net = {
      id: generateUniqueId('net'),
      name: netName,
      nodes: connectedNodeIds,
      type: determineNetType(connectedNodeIds, nodes),
    };
    
    nets.set(net.id, net);
    connectedNodeIds.forEach(id => visited.add(id));
  }
  
  return nets;
}
```

### Phase 5: KiCad Netlist Export (To Be Implemented)

Generate KiCad Protel netlist format:

```typescript
function exportKiCadNetlist(
  components: PCBComponent[],
  nets: Map<string, Net>,
  nodes: Map<string, Node>
): string {
  let netlist = '(\n';
  
  // Export components
  netlist += '  (components\n';
  for (const comp of components) {
    netlist += `    (comp (ref ${comp.designator})\n`;
    netlist += `      (value ${getComponentValue(comp)})\n`;
    netlist += `      (footprint ${comp.packageType || 'Unknown'})\n`;
    if (comp.componentType === 'IntegratedCircuit') {
      netlist += `      (datasheet ${comp.datasheet || ''})\n`;
    }
    netlist += '    )\n';
  }
  netlist += '  )\n';
  
  // Export nets
  netlist += '  (nets\n';
  for (const [netId, net] of nets) {
    netlist += `    (net (code ${netId}) (name ${net.name})\n`;
    
    // List all nodes in this net
    for (const nodeId of net.nodes) {
      const node = nodes.get(nodeId);
      if (node && node.type === 'component_pin') {
        const comp = findComponent(node.componentId!, components);
        netlist += `      (node (ref ${comp.designator}) (pin ${node.pinIndex! + 1}))\n`;
      }
    }
    netlist += '    )\n';
  }
  netlist += '  )\n';
  
  netlist += ')\n';
  return netlist;
}
```

## Net Naming Strategy

### Automatic Net Names

1. **Ground Nets**: Always named `"GND"` or `"GROUND"`
2. **Power Nets**: Named by voltage (e.g., `"+5V"`, `"+3.3V"`, `"-12V"`)
3. **Signal Nets**: Auto-generated names:
   - If connected to named component pins: Use pin name (e.g., `"RESET"`, `"CLK"`)
   - Otherwise: Sequential names (e.g., `"N$1"`, `"N$2"`, `"N$3"`)

### User-Editable Net Names

Allow users to rename nets for clarity:
- Right-click on trace → "Rename Net"
- Dialog shows current net name and allows editing
- All nodes in the net are updated

## Component Pin to Node Mapping

### Current System ✅

Each component has:
```typescript
{
  pinCount: number;
  pinConnections: string[];  // Array of node IDs (size = pinCount)
}
```

### Example

```typescript
// Integrated circuit U1 with 8 pins
{
  id: 'comp-1234567890-abc',
  designator: 'U1',
  componentType: 'IntegratedCircuit',
  pinCount: 8,
  pinConnections: [
    'via-111',      // Pin 1 → Via-111
    'via-222',      // Pin 2 → Via-222
    '',             // Pin 3 → Unconnected
    'gnd-333',      // Pin 4 → Ground
    'pwr-444',      // Pin 5 → +5V power
    'via-555',      // Pin 6 → Via-555
    'via-666',      // Pin 7 → Via-666
    'gnd-777',      // Pin 8 → Ground
  ]
}
```

### Net Assignment from Component Pins

When building the connectivity graph:

```typescript
function addComponentPinNodes(
  component: PCBComponent,
  nodes: Map<string, Node>,
  connections: Connection[]
): void {
  for (let i = 0; i < component.pinCount; i++) {
    const nodeId = component.pinConnections[i];
    if (nodeId === '') continue; // Unconnected pin
    
    // Create a virtual node for the component pin
    const pinNodeId = `${component.id}-pin${i}`;
    nodes.set(pinNodeId, {
      id: pinNodeId,
      type: 'component_pin',
      x: component.x,
      y: component.y,
      componentId: component.id,
      pinIndex: i,
    });
    
    // Create connection from pin to the referenced node
    connections.push({
      fromNodeId: pinNodeId,
      toNodeId: nodeId,
    });
  }
}
```

## Validation and Error Checking

### Connection Validation

```typescript
interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  elementIds: string[];
}

function validateConnections(
  components: PCBComponent[],
  vias: Via[],
  grounds: GroundSymbol[],
  powerNodes: PowerNode[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check 1: All component pins reference valid nodes
  for (const comp of components) {
    for (let i = 0; i < comp.pinCount; i++) {
      const nodeId = comp.pinConnections[i];
      if (nodeId === '') continue;
      
      const nodeExists = 
        vias.some(v => v.id === nodeId) ||
        grounds.some(g => g.id === nodeId) ||
        powerNodes.some(p => p.id === nodeId);
      
      if (!nodeExists) {
        errors.push({
          type: 'error',
          message: `Component ${comp.designator} pin ${i + 1} references non-existent node ${nodeId}`,
          elementIds: [comp.id],
        });
      }
    }
  }
  
  // Check 2: Warn about unconnected component pins
  for (const comp of components) {
    const unconnectedPins = comp.pinConnections
      .map((conn, idx) => conn === '' ? idx + 1 : null)
      .filter(pin => pin !== null);
    
    if (unconnectedPins.length > 0) {
      errors.push({
        type: 'warning',
        message: `Component ${comp.designator} has unconnected pins: ${unconnectedPins.join(', ')}`,
        elementIds: [comp.id],
      });
    }
  }
  
  // Check 3: Warn about isolated nets (no components)
  // ... (implement net analysis first)
  
  return errors;
}
```

## Example Netlist Output

### KiCad Protel Format

```
(
  (components
    (comp (ref U1)
      (value TL072)
      (footprint DIP-8)
      (datasheet http://www.ti.com/lit/ds/symlink/tl072.pdf)
    )
    (comp (ref R1)
      (value 10k)
      (footprint 0805)
    )
    (comp (ref C1)
      (value 100nF)
      (footprint 0805)
    )
  )
  (nets
    (net (code 1) (name GND)
      (node (ref U1) (pin 4))
      (node (ref U1) (pin 8))
      (node (ref C1) (pin 2))
    )
    (net (code 2) (name +5V)
      (node (ref U1) (pin 5))
      (node (ref C1) (pin 1))
    )
    (net (code 3) (name SIGNAL_IN)
      (node (ref U1) (pin 1))
      (node (ref R1) (pin 1))
    )
    (net (code 4) (name SIGNAL_OUT)
      (node (ref U1) (pin 6))
      (node (ref R1) (pin 2))
    )
  )
)
```

## Implementation Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Unique IDs for all PCB elements
- [x] Component pin connections array
- [x] Power node voltage tagging
- [x] Ground symbol placement

### Phase 2: Connectivity Analysis (Next)
- [ ] Create `src/utils/netlist.ts` utility module
- [ ] Implement `Connection` and `Node` interfaces
- [ ] Implement trace-to-node analysis
- [ ] Build connectivity graph

### Phase 3: Net Assignment (Next)
- [ ] Implement graph traversal (union-find or BFS)
- [ ] Assign nets to connected nodes
- [ ] Generate automatic net names
- [ ] Allow user net renaming

### Phase 4: Validation (Next)
- [ ] Validate component pin connections
- [ ] Detect unconnected pins
- [ ] Detect isolated nets
- [ ] Generate warnings/errors

### Phase 5: Export (Next)
- [ ] Implement KiCad Protel netlist export
- [ ] Add "Export Netlist" to File menu
- [ ] Save netlist to .net file
- [ ] Test with nl2sch tool

## Conclusion

### ✅ Current ID System is Excellent for Netlist Generation

**Recommendation**: Keep the current ID system as-is.

**Reasons:**
1. All elements have unique, persistent IDs
2. Component pins reference nodes via ID strings
3. IDs are human-readable and traceable
4. System is ready for netlist generation
5. No changes needed to existing code

### Next Steps

1. **Implement connectivity analysis** (`src/utils/netlist.ts`)
2. **Build connectivity graph** from traces and nodes
3. **Assign nets** using graph traversal
4. **Export KiCad netlist** in Protel format
5. **Add UI** for net management and validation

The foundation is solid! 🎉

