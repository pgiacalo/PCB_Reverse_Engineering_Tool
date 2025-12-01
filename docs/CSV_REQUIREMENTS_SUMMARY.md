# CSV Export Requirements Summary

## Current Behavior

The CSV file currently:
- Lists **ALL nodes** (vias, pads, power, ground, component_pins) except trace_points
- For each node, lists **ALL connected nodes** found via full DFS traversal through all traces
- Lists all connected components found through the full traversal

## New Requirements

### Requirement 1: Filter to Nodes with Directly Attached Components
- **Only include nodes that have directly attached components**
- A node qualifies if:
  - The node itself is a `component_pin` type, OR
  - The node has component pins directly connected to it (first-level connection, not through intermediate nodes)

### Requirement 2: Limit Connected Nodes to First-Level Only
- For each subject node, **only list the first/direct connected nodes**
- Do NOT traverse through all traces to find all connected nodes
- Only show immediate neighbors (nodes directly connected via a single trace segment)
- This means if Node A connects to Node B via a trace, and Node B connects to Node C via another trace:
  - Node A's CSV row should only show Node B (not Node C)
  - Node B's CSV row should show both Node A and Node C

## Implementation Changes Needed

1. **Filter nodes**: Before adding a row, check if the node has component pins attached (either directly or through first-level connections)

2. **Modify connection traversal**: Instead of `traverseNodeConnections()` which does full DFS, create a new function that only gets first-level/direct neighbors

3. **Build direct adjacency**: Use the adjacency list but only return immediate neighbors, not all reachable nodes

## Expected CSV Output Format

The CSV format remains the same:
- Header: `Node ID,Node Type,Connected Node IDs,Connected Components,Connected Component Pins`
- But the content will be filtered and limited as described above

