# KiCad Netlist Implementation

## Overview

This document describes the implementation of KiCad-compatible netlist generation in the PCB Reverse Engineering Tool. The netlist generation system analyzes all PCB elements (traces, vias, components, power nodes, and ground nodes) to determine electrical connectivity and exports the results in KiCad Protel format.

## Location of Export Functionality

**Menu Location**: `File -> Export Netlist…`

The export button is located in the File menu, positioned after "Auto Save…" and before the separator line that precedes "Print…". When clicked, it generates a `.net` file (e.g., `project_name.net`) that can be imported into KiCad or used with tools like `nl2sch` for schematic generation.

## Architecture

### Core Module: `src/utils/netlist.ts`

The netlist generation is implemented as a utility module with the following key components:

#### 1. Data Structures

**NetlistNode**: Represents a single electrical connection point
```typescript
interface NetlistNode {
  id: number;              // Point ID (globally unique)
  type: 'via' | 'power' | 'ground' | 'component_pin' | 'trace_point';
  x: number;               // X coordinate
  y: number;               // Y coordinate
  componentId?: string;     // For component pins
  pinIndex?: number;       // 0-based pin index
  voltage?: string;        // For power nodes (e.g., "+5V")
  powerBusId?: string;     // For power nodes
}
```

**Net**: Represents a collection of electrically connected nodes
```typescript
interface Net {
  id: string;              // Net name (e.g., "GND", "+5V", "N$1")
  name: string;            // Display name
  nodes: NetlistNode[];    // All nodes in this net
  netCode: number;         // Sequential code for KiCad export
}
```

#### 2. Union-Find Algorithm

A Union-Find (Disjoint Set Union) data structure is used to efficiently group connected nodes into nets. This algorithm:
- Maintains a parent map for each node
- Uses path compression for efficiency
- Groups nodes that are connected through traces
- Returns all connected groups

**Key Methods**:
- `find(x)`: Finds the root of a node's group
- `union(x, y)`: Merges two groups
- `getGroups()`: Returns all groups of connected nodes

### Processing Pipeline

#### Step 1: Build Connectivity Graph (`buildConnectivityGraph`)

Collects all nodes from various PCB elements:

1. **Drawing Strokes** (Traces and Vias):
   - Vias: Single-point nodes (type: `'via'`)
   - Traces: All points in the trace path (type: `'trace_point'`)

2. **Power Symbols**:
   - Creates nodes with type `'power'`
   - Extracts voltage from associated PowerBus
   - Stores `powerBusId` for reference

3. **Ground Symbols**:
   - Creates nodes with type `'ground'`
   - All ground nodes will be grouped into the "GND" net

4. **Component Pin Connections**:
   - Reads `pinConnections` array from each component
   - Creates or updates nodes with type `'component_pin'`
   - Links to component ID and pin index

#### Step 2: Build Connections (`buildConnections`)

Analyzes drawing strokes to determine which nodes are connected:

- **Traces**: Connects consecutive points in the trace path
  - Point[i] is connected to Point[i+1] for all i in [0, length-2]
- **Vias**: Single points that connect to traces through shared point IDs

#### Step 3: Group Nodes into Nets (`groupNodesIntoNets`)

Uses Union-Find algorithm to group all connected nodes:

1. Initialize Union-Find structure
2. For each connection [nodeId1, nodeId2]:
   - Union the two nodes (they're electrically connected)
3. Extract groups: All nodes with the same root are in the same net

#### Step 4: Generate Net Names (`generateNetNames`)

Assigns meaningful names to nets based on node types:

1. **Ground Nets**: Named `"GND"` if any node is type `'ground'`
2. **Power Nets**: Named using voltage from power node (e.g., `"+5V"`, `"+3.3V"`)
   - Cleans voltage string (removes spaces, ensures +/- prefix)
3. **Signal Nets**: Sequential names `"N$1"`, `"N$2"`, `"N$3"`, etc.

#### Step 5: Generate KiCad Protel Format (`generateKiCadNetlist`)

Main export function that orchestrates the pipeline and generates the netlist file:

1. Executes Steps 1-4
2. Creates `Net` objects with net codes
3. Sorts nets: GND first, then power nets, then signal nets
4. Generates KiCad Protel format string

### KiCad Protel Format Structure

The generated netlist follows this structure:

```
(
  (components
    (comp (ref U1)
      (value TL072)
      (footprint DIP-8)
      (datasheet http://...)
    )
    (comp (ref R1)
      (value 10k)
      (footprint R_0805)
    )
    ...
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
    (net (code 3) (name N$1)
      (node (ref U1) (pin 1))
      (node (ref R1) (pin 1))
    )
    ...
  )
)
```

### Component Value Extraction

The `getComponentValue` function extracts component values in this priority order:

1. `resistance` (for resistors)
2. `capacitance` (for capacitors)
3. `inductance` (for inductors)
4. `partNumber` (for any component)
5. `designator` (fallback)
6. `componentType` (final fallback)

### Component Footprint Mapping

The `getComponentFootprint` function determines footprints:

1. Uses `packageType` if available
2. Falls back to default footprints based on component type:
   - Resistor → `"R_0805"`
   - Capacitor → `"C_0805"`
   - Inductor → `"L_0805"`
   - Diode → `"D_SOD-123"`
   - Transistor → `"TO-92"`
   - IntegratedCircuit → `"DIP-8"`
3. Returns `"Unknown"` if no match

## Integration with App.tsx

### Export Function

The `exportNetlist` callback function in `App.tsx`:

1. Collects all components from both layers (`componentsTop` and `componentsBottom`)
2. Calls `generateKiCadNetlist` with all PCB data
3. Creates a Blob with the netlist content
4. Uses File System Access API to save the file (with download fallback)
5. Saves as `{projectName}.net`

### Dependencies

The export function depends on:
- `componentsTop`: Top layer components
- `componentsBottom`: Bottom layer components
- `drawingStrokes`: All traces and vias
- `powers`: Power symbol nodes
- `grounds`: Ground symbol nodes
- `powerBuses`: Power bus definitions (for voltage information)
- `projectName`: For filename generation

## Key Design Decisions

### 1. Point ID System

All nodes use globally unique integer point IDs (`number` type) generated by `generatePointId()`. This ensures:
- Uniqueness across all PCB elements
- Efficient connectivity graph building
- Simple union-find operations

### 2. Component Pin Connections

Component pins reference nodes via the `pinConnections` array:
- Array size equals `pinCount`
- Each element is a point ID string (or empty string for unconnected pins)
- Point IDs are parsed to integers for graph building

### 3. Net Naming Strategy

- **GND**: Always named "GND" (highest priority)
- **Power**: Uses voltage from PowerBus (e.g., "+5V", "+3.3V")
- **Signals**: Sequential naming ("N$1", "N$2", etc.)

This ensures predictable net names that are compatible with KiCad conventions.

### 4. Net Sorting

Nets are sorted before export:
1. GND first
2. Power nets (those starting with + or -)
3. Signal nets (alphabetically)

This provides a logical organization in the exported file.

## Limitations and Future Enhancements

### Current Limitations

1. **No User Net Renaming**: All net names are auto-generated
2. **No Validation**: Doesn't warn about unconnected pins or isolated nets
3. **Basic Footprint Mapping**: Uses simple defaults
4. **No Net Preview**: Users can't see the netlist before export

### Potential Enhancements

1. **Net Name Editor**: Allow users to rename nets for clarity
2. **Validation System**: 
   - Detect unconnected component pins
   - Warn about isolated nets
   - Validate component designators
3. **Enhanced Footprint Mapping**: 
   - Use component package type more intelligently
   - Support custom footprint mappings
4. **Netlist Preview Dialog**: Show generated netlist before export
5. **Export Options**: 
   - Choose netlist format variants
   - Include/exclude specific nets
   - Custom net naming rules

## Testing

To test the netlist generation:

1. Create a project with components, traces, vias, power, and ground
2. Connect component pins to nodes (via the Component Properties dialog)
3. Select `File -> Export Netlist…`
4. Save the `.net` file
5. Import into KiCad or use with `nl2sch` tool

## Example Workflow

1. **Place Components**: Add components to top/bottom layers
2. **Draw Traces**: Connect points with traces
3. **Add Vias**: Connect top and bottom layers
4. **Place Power/Ground**: Add power nodes and ground symbols
5. **Connect Component Pins**: 
   - Double-click component
   - Click "Connect Pin" button
   - Click on via, trace point, power node, or ground node
6. **Export Netlist**: Use `File -> Export Netlist…`
7. **Import to KiCad**: Open the `.net` file in KiCad or use `nl2sch`

## File Structure

```
src/
  utils/
    netlist.ts          # Core netlist generation logic
  App.tsx               # Export function and menu integration
  types/
    index.ts            # Type definitions for PCB elements
```

## References

- [KiCad Netlist Format Documentation](https://dev-docs.kicad.org/en/file-formats/sexpr-netlist/)
- [nl2sch Tool](https://github.com/tpecar/nl2sch) - Netlist to KiCad schematic conversion
- Original Strategy Document: `docs_lessons_learned/NETLIST_STRATEGY.md`


