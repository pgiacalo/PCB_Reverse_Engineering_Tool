# Netlist Connectivity: How It Works

## Overview

The netlist generation system uses a **Point ID-based connectivity system** rather than coordinate-based matching. This document explains exactly how connections are identified and how the netlist is built.

## Key Principle: Point IDs, Not Coordinates

**The system does NOT use coordinate matching (x,y comparison) to find connections.** Instead, it uses a globally unique **Point ID system** where:

- Every via, trace point, power node, and ground node has a unique integer Point ID
- Component pins store the Point ID of the element they're connected to
- Elements with the same Point ID are automatically electrically connected
- Traces connect consecutive points by their Point IDs

## How Connections Are Established

### 1. When User Draws a Trace

When a user draws a trace:
1. Each click creates a `DrawingPoint` with a unique Point ID (from `generatePointId()`)
2. The trace is stored as a `DrawingStroke` with a `points` array
3. Consecutive points in the array are connected (point[i] connects to point[i+1])

**Example:**
```
Trace with points: [id: 10, id: 11, id: 12]
Connections created: 10↔11, 11↔12
```

### 2. When User Places a Via

When a user places a via:
1. A `DrawingStroke` with `type: 'via'` is created
2. It contains a single `DrawingPoint` with a unique Point ID
3. This Point ID can be referenced by component pins or shared with trace points

**Example:**
```
Via created with point: {id: 5, x: 100, y: 200}
Point ID 5 is now available for connections
```

### 3. When User Connects a Component Pin to a Via/Trace

When connecting a component pin (via the Component Properties dialog):
1. User clicks "Connect Pin" button for a specific pin
2. User clicks on a via, trace point, power node, or ground node
3. The system finds the nearest element using **coordinate-based snapping** (with tolerance)
4. The component's `pinConnections[pinIndex]` array is updated with the **Point ID** (as a string)

**Important:** The coordinate matching happens **only during the connection UI interaction**. Once connected, the relationship is stored as a Point ID reference, not coordinates.

**Example:**
```
Component U1, Pin 1 → User clicks on Via (point ID 5)
Result: pinConnections[0] = "5"
```

### 4. When User Places Power/Ground Nodes

When placing power or ground symbols:
1. A `PowerSymbol` or `GroundSymbol` is created
2. A Point ID is generated and stored in `pointId`
3. This Point ID can be shared with vias/traces if they're placed at the same location

## How the Netlist is Built

### Step 1: Build Connectivity Graph (`buildConnectivityGraph`)

This function collects all nodes from various sources:

1. **From Drawing Strokes (Traces and Vias):**
   - Vias: Extract the single point's ID → create node with type `'via'`
   - Traces: Extract all point IDs → create nodes with type `'trace_point'`

2. **From Power Symbols:**
   - Extract `pointId` → create node with type `'power'`
   - Include voltage information from associated PowerBus

3. **From Ground Symbols:**
   - Extract `pointId` → create node with type `'ground'`

4. **From Component Pin Connections:**
   - Read `pinConnections` array for each component
   - Parse the Point ID string to integer
   - If node doesn't exist, create it as `'component_pin'`
   - If node already exists (from via/trace), update it to mark it as a component pin

**Key Insight:** If a component pin references Point ID 5, and a via also has Point ID 5, they become the **same node** in the map (same key = same node).

### Step 2: Build Connections (`buildConnections`)

This function creates connection pairs from traces:

- For each trace, connect consecutive points: `[point[i].id, point[i+1].id]`
- Vias don't create connections here (they're single points)
- Vias connect to traces through **shared Point IDs**

**Example:**
```
Trace: points [id: 10, id: 11, id: 12]
Connections: [[10, 11], [11, 12]]

Via: point id: 11
Result: Via with ID 11 is automatically connected to the trace
        because they share the same Point ID (11)
```

### Step 3: Group Nodes into Nets (`groupNodesIntoNets`)

Uses Union-Find algorithm to group connected nodes:

1. **Union nodes connected by traces:**
   - For each connection [id1, id2], union the two nodes
   - This groups all nodes connected through traces

2. **Nodes with same Point ID are automatically connected:**
   - Since nodes with the same Point ID are the same node (same map key)
   - No explicit union needed - they're already the same object

3. **Extract groups:**
   - Each group represents a net (electrically connected nodes)

**Example:**
```
Via (ID 5) connected to Trace point (ID 5) → Same node
Trace: [5, 6, 7] → Nodes 5, 6, 7 are in same net
Component pin references ID 5 → Also in same net
Result: All connected in one net
```

### Step 4: Generate Net Names (`generateNetNames`)

Assigns names based on node types in each net:
- Ground nodes → "GND"
- Power nodes → voltage string (e.g., "+5V")
- Signal nets → sequential ("N$1", "N$2", etc.)

### Step 5: Export to KiCad Format

Generates the netlist file showing:
- Components with their designators, values, footprints
- Nets with component pin connections

## Why Point IDs Instead of Coordinates?

### Advantages:

1. **Exact Matching:** No tolerance issues - either connected or not
2. **Performance:** O(1) lookups instead of distance calculations
3. **Explicit Connections:** User explicitly connects pins to vias/traces
4. **Reliability:** No floating-point precision issues
5. **Traceability:** Can track exactly which elements are connected

### How Coordinate Matching is Used:

Coordinate matching **is used** but only during the UI interaction phase:

1. When user clicks to connect a component pin:
   - System searches for nearest via/trace point within tolerance
   - Finds the Point ID of that element
   - Stores the Point ID (not coordinates) in `pinConnections`

2. When user draws a trace:
   - System may snap to existing vias (coordinate-based)
   - If snapping occurs, the trace point **reuses the via's Point ID**
   - This creates the connection

## Example: Complete Connection Flow

### Scenario: Component U1 Pin 1 → Via → Trace → Component U2 Pin 1

1. **User places Via:**
   ```
   Via created: {point: {id: 100, x: 100, y: 200}}
   ```

2. **User draws Trace starting at Via:**
   ```
   Trace created: {points: [
     {id: 100, x: 100, y: 200},  // Reuses via's Point ID (snapped)
     {id: 101, x: 150, y: 200},
     {id: 102, x: 200, y: 200}
   ]}
   Connections: 100↔101, 101↔102
   ```

3. **User connects U1 Pin 1 to Via:**
   ```
   User clicks via (finds Point ID 100)
   U1.pinConnections[0] = "100"
   ```

4. **User connects U2 Pin 1 to end of Trace:**
   ```
   User clicks trace end point (finds Point ID 102)
   U2.pinConnections[0] = "102"
   ```

5. **Netlist Generation:**
   ```
   Nodes created:
   - Node 100: via + component_pin (U1, pin 1)
   - Node 101: trace_point
   - Node 102: trace_point + component_pin (U2, pin 1)
   
   Connections: [100, 101], [101, 102]
   
   Union-Find groups: {100, 101, 102} → All in same net
   
   Net output:
   (net (code 1) (name N$1)
     (node (ref U1) (pin 1))
     (node (ref U2) (pin 1))
   )
   ```

## Current Issue: Why Component Connections Might Be Missing

Based on the code analysis, potential issues:

1. **Point ID Mismatch:**
   - Component `pinConnections` stores Point ID as string
   - Must parse correctly: `parseInt(nodeIdStr.trim(), 10)`
   - If Point ID doesn't exist in nodes map, connection is lost

2. **Node Not Created:**
   - If component pin references Point ID that doesn't exist in drawingStrokes
   - Node is created as `component_pin` only
   - But if no trace connects to it, it's an isolated node

3. **Type Overwriting:**
   - When component pin references existing node (via/trace), we update type to `component_pin`
   - This is correct for output, but the node should still be connected through its Point ID

4. **Missing Connections:**
   - If a via and trace don't share Point IDs (weren't snapped), they won't connect
   - Component pin connected to via won't connect to trace unless via and trace share Point ID

## Debugging Steps

When component connections are missing:

1. **Check Component Pin Connections:**
   - Verify `pinConnections` array has Point IDs (not empty strings)
   - Check console for "Component U1: X/14 pins connected"

2. **Check Point ID Existence:**
   - Verify Point IDs in `pinConnections` exist in nodes map
   - Check console for "node exists: true/false"

3. **Check Net Assignment:**
   - Verify component pins are assigned to nets
   - Check console for "net: N$X" for each pin

4. **Check Trace Connections:**
   - Verify traces connect vias (shared Point IDs)
   - If via has Point ID 100, trace should also have point with ID 100

## Summary

**The netlist system uses Point IDs, not coordinate matching:**

- ✅ **Point ID-based:** Elements with same Point ID = same node = connected
- ✅ **Trace connections:** Consecutive points in trace are connected
- ✅ **Union-Find:** Groups all connected nodes into nets
- ❌ **NOT coordinate-based:** No x,y distance calculations during netlist generation
- ⚠️ **Coordinate matching:** Only used during UI interaction (snapping, clicking)

The coordinate matching happens when the user **creates** connections (clicking to connect pins, snapping traces to vias), but once established, all relationships are stored and processed using Point IDs.


