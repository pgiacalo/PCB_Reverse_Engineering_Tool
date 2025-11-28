# Schematic Generation Algorithm: Graph Transformation Approach

## Overview

Converting a physical PCB layout to a schematic is fundamentally a **graph transformation and abstraction problem**. This document outlines the recommended algorithm approach for improving schematic generation and CSV file creation.

## Core Algorithm: Connectivity Graph to Hierarchical Schematic

### Phase 1: Build the Netlist Graph

1. **Extract connectivity**: From PCB data, build a graph where:
   - **Nodes** = component pins
   - **Edges** = electrical connections (traces, vias, pads on same net)

2. **Net identification**: Group all connected copper into nets. Use flood-fill or union-find to identify continuous electrical connections across layers via through-holes and vias.

3. **Component identification**: Match footprint patterns to component symbols (resistors, ICs, connectors, etc.)

### Phase 2: Logical Grouping & Hierarchy Detection

This is where the "art" happens - turning spaghetti into readable schematics:

1. **Power/Ground net identification**: 
   - Detect large copper pours, many connections
   - Label VCC, GND, etc.

2. **Functional block clustering**:
   - Use **community detection algorithms** (Louvain method, modularity optimization) on the netlist graph
   - Components that share many nets likely belong to the same functional block
   - Look for common patterns (voltage regulators, decoupling caps near ICs, crystal oscillator pairs)

3. **Signal flow detection**:
   - Identify input/output connectors
   - Trace signal paths using **topological sorting** of the directed graph
   - This helps determine left-to-right schematic flow

### Phase 3: Schematic Generation (KiCad Format)

1. **Symbol placement**:
   - Use **force-directed graph layout** algorithms (Fruchterman-Reingold) as starting point
   - Apply constraints: power symbols at top, ground at bottom, inputs left, outputs right
   - Group clustered components spatially

2. **Wire routing**:
   - KiCad schematics prefer orthogonal routing
   - Use **orthogonal connector routing** algorithms (Lee algorithm, A* with Manhattan distance)
   - Minimize wire crossings using **planarization** techniques where possible

3. **Hierarchical sheets** (optional):
   - Create sub-sheets for major functional blocks identified in Phase 2
   - This improves readability for complex boards

## Recommended Implementation Strategy

### Python Example (for reference)

```python
import networkx as nx

# Phase 1: Build graph
G = nx.Graph()
for component in components:
    for pin in component.pins:
        G.add_node(pin.id, component=component, pin_name=pin.name)

for net in nets:
    pins_on_net = get_pins_on_net(net)
    for i in range(len(pins_on_net)-1):
        G.add_edge(pins_on_net[i], pins_on_net[i+1], net=net.name)

# Phase 2: Clustering
communities = nx.community.louvain_communities(G)

# Phase 3: Layout
pos = nx.spring_layout(G)  # Starting positions
# Apply constraints and optimize...
```

## Key Algorithms to Research

1. **Community detection**: Louvain or Girvan-Newman for functional grouping
2. **Force-directed layout**: Fruchterman-Reingold for initial placement
3. **Orthogonal routing**: Lee's algorithm or A* for schematic wires
4. **Crossing minimization**: Sugiyama framework for layered graphs

## Practical Considerations

- **Component orientation**: Match pin arrangements to standard schematic conventions (e.g., power pins on ICs facing up/down)
- **Net labeling**: Use intelligent naming (CLK, MOSI, TX, etc.) based on common patterns
- **Reference designators**: Preserve or intelligently reassign (U1, R1, etc.)

## Current Implementation Status

### CSV Export (Implemented)
- ✅ Filters to only nodes with directly attached components
- ✅ Shows only first-level/direct connected nodes (not full traversal)
- ✅ Lists component pins attached to each node

### Schematic Generation (Future Work)
- ⏳ Basic schematic generation exists but could benefit from:
  - Community detection for functional grouping
  - Force-directed layout algorithms
  - Orthogonal wire routing
  - Intelligent net naming
  - Hierarchical sheet support

## The Challenge

The hardest part isn't the algorithm itself, but the **heuristics for readability** - professional schematics follow conventions that make them intuitive to read. You'll need rules for things like:
- "Always draw bypass caps near their IC"
- "Group differential pairs visually"
- "Power symbols at top, ground at bottom"
- "Inputs on left, outputs on right"

## Next Steps

1. **Short-term**: Test and refine the CSV export changes
2. **Medium-term**: Implement community detection for functional grouping
3. **Long-term**: Add force-directed layout and orthogonal routing for improved schematic readability

