# Netlist Schema Discussion: Current vs. Proposed Node-Centric Design

## Current Implementation (Net-Centric)

### Structure
```json
{
  "design_info": {
    "name": "reversed_pcb",
    "date": "2025-01-09"
  },
  "components": [
    {
      "designator": "U1",
      "part_number": "SN74AC14",
      "package": "DIP14",
      "pins": [
        {"number": "1", "name": "1A", "type": "input"},
        {"number": "7", "name": "GND", "type": "power"},
        {"number": "14", "name": "VCC", "type": "power"}
      ]
    }
  ],
  "nets": [
    {
      "name": "GND",
      "connections": [
        {
          "component": "U1",
          "pin_number": "7",
          "pin_name": "GND",
          "pin_type": "power",
          "ground_bus": "GND"
        },
        {
          "component": "C1",
          "pin_number": "2",
          "pin_name": "2",
          "pin_type": "passive"
        }
      ]
    },
    {
      "name": "+5V",
      "connections": [
        {
          "component": "U1",
          "pin_number": "14",
          "pin_name": "VCC",
          "pin_type": "power",
          "power_bus": "+5V"
        }
      ]
    }
  ]
}
```

### Characteristics
- **Net-centric**: Organized by nets, each listing its component connections
- **No physical elements**: Vias, pads, traces not included in export
- **No positions**: Component positions not included
- **No NodeId exposure**: Internal NodeIds used for connectivity but not exported
- **Minimal redundancy**: Each connection listed once under its net
- **Industry standard compatible**: Matches KiCad/PADS netlist formats

## Proposed Implementation (Node-Centric)

### Structure
```json
{
  "design_info": {
    "name": "PCB_Design",
    "version": "1.0",
    "units": "mm"
  },
  "nodes": {
    "node_001": {
      "net_name": "GND",
      "type": "power",
      "connections": [
        {"type": "component_pin", "ref": "U1", "pin": "7"},
        {"type": "component_pin", "ref": "C1", "pin": "2"},
        {"type": "via", "ref": "via_045", "layer_from": "top", "layer_to": "bottom"},
        {"type": "pad", "ref": "pad_gnd_1", "layer": "bottom"}
      ]
    }
  },
  "components": [
    {
      "designator": "U1",
      "part_number": "SN74AC14",
      "package": "DIP14",
      "position": {"x": 50.0, "y": 30.0, "rotation": 0, "layer": "top"},
      "pins": [
        {"number": "1", "name": "1A", "type": "input", "node_id": "node_003"},
        {"number": "7", "name": "GND", "type": "power", "node_id": "node_001"},
        {"number": "14", "name": "VCC", "type": "power", "node_id": "node_002"}
      ]
    }
  ],
  "physical_elements": {
    "vias": [...],
    "pads": [...],
    "traces": [...]
  }
}
```

### Characteristics
- **Node-centric**: Organized by nodes (equipotential sets)
- **Includes physical elements**: Vias, pads, traces with positions
- **Bidirectional references**: Nodes→components AND components→nodes
- **Exposes NodeIds**: NodeIds are part of the schema
- **Higher redundancy**: Each connection appears in multiple places
- **Complete physical representation**: Full PCB layout information

## Comparison

| Aspect | Current (Net-Centric) | Proposed (Node-Centric) |
|--------|----------------------|------------------------|
| **Primary Organization** | By nets | By nodes |
| **File Size** | Smaller (~30-50% less) | Larger (redundant refs + physical data) |
| **Query: "What's on net GND?"** | Direct lookup | Iterate nodes, filter by net_name |
| **Query: "What connects to node_001?"** | Must search all nets | Direct lookup |
| **Query: "Where is via_045?"** | Not available | Direct lookup in physical_elements |
| **Physical Layout Info** | Not included | Fully included |
| **Industry Tool Compatibility** | High (KiCad, PADS, Altium) | Low (custom format) |
| **Validation Complexity** | Low | High (bidirectional refs) |
| **Use Case** | Schematic generation, BOM, EDA import | PCB layout reconstruction, troubleshooting |

## Analysis

### Strengths of Current Approach
1. **Industry Standard**: Matches established netlist formats (KiCad, SPICE, PADS)
2. **Focused Purpose**: Optimized for electrical connectivity (schematic generation)
3. **Smaller Files**: No redundant references or physical data
4. **Simple Validation**: Each connection appears once
5. **EDA Tool Import**: Can be imported into KiCad, Altium, etc.
6. **Query Efficiency**: Fast "what's on this net?" queries

### Strengths of Proposed Approach
1. **Complete PCB Representation**: Includes physical layout, not just connectivity
2. **Troubleshooting Friendly**: Can trace physical paths (via→trace→component)
3. **Bidirectional Queries**: Efficient both ways (node→components, component→node)
4. **Single Source of Truth**: NodeId is canonical connection point
5. **Validation Capabilities**: Can verify bidirectional consistency
6. **Physical Analysis**: Can analyze trace lengths, via positions, etc.

### Weaknesses of Current Approach
1. **No Physical Data**: Can't reconstruct PCB layout from netlist alone
2. **No Via/Pad Info**: Physical connection points not represented
3. **Limited Troubleshooting**: Can't trace physical signal paths
4. **No Spatial Queries**: Can't ask "what's near component X?"

### Weaknesses of Proposed Approach
1. **Not Industry Standard**: Custom format, no direct EDA tool import
2. **Larger Files**: Redundant references increase size significantly
3. **Complex Validation**: Must maintain bidirectional consistency
4. **Query Complexity**: "What's on net GND?" requires filtering all nodes
5. **Maintenance Burden**: Changes require updating multiple locations

## Recommendation: Hybrid Approach

### Option 1: Dual Export Formats
Provide BOTH formats, each optimized for its use case:

1. **Standard Netlist (Current)**: For EDA tool import, schematic generation, BOM
2. **Extended PCB Format (Proposed)**: For troubleshooting, layout analysis, AI analysis

### Option 2: Extended Current Format
Enhance current format with optional physical data:

```json
{
  "design_info": {...},
  "components": [
    {
      "designator": "U1",
      "pins": [...],
      "position": {"x": 50.0, "y": 30.0, "rotation": 0, "layer": "top"}  // ADDED
    }
  ],
  "nets": [...],
  "physical_elements": {  // ADDED (optional section)
    "vias": [
      {
        "id": "via_045",
        "net_name": "GND",
        "position": {"x": 45.0, "y": 28.0},
        "diameter": 0.3
      }
    ],
    "traces": [...]
  }
}
```

**Benefits:**
- Maintains industry compatibility (tools can ignore physical_elements)
- Adds physical data for troubleshooting
- No redundant bidirectional references
- Smaller than full node-centric approach
- Single export format

### Option 3: Node-Centric with Net Index
Add a "nets" index to node-centric format for efficient net queries:

```json
{
  "nodes": {...},
  "components": {...},
  "physical_elements": {...},
  "nets_index": {  // ADDED: Fast lookup by net name
    "GND": ["node_001", "node_005", "node_012"],
    "+5V": ["node_002", "node_008"]
  }
}
```

## Use Case Analysis

### For PCB Reverse Engineering (Our Primary Use Case)
**Current format is sufficient** because:
- Main goal: Generate schematic from traced PCB
- Output: Import into KiCad/Altium for further work
- Physical layout already visible in the app's UI
- Troubleshooting can use internal data structures (don't need export)

**Node-centric would help** if:
- Exporting for external troubleshooting tools
- Sharing PCB data with AI analysis systems
- Archiving complete PCB layout (not just connectivity)
- Building PCB layout reconstruction tools

### For AI Troubleshooting Feature
The AI troubleshooting feature (currently in development) could benefit from node-centric format:
- Can trace physical signal paths
- Can identify via locations for testing
- Can analyze trace routing
- Can provide spatial context ("measure at via near U1 pin 3")

**However**, we can provide this data directly to AI without changing export format:
- Build node-centric structure in memory for AI analysis
- Keep standard netlist export for EDA tools
- Best of both worlds

## Proposed Implementation Strategy

### Phase 1: Keep Current Format (Immediate)
- Current net-centric format works well for primary use case
- Industry standard, EDA tool compatible
- No breaking changes needed

### Phase 2: Add Physical Data (Optional Enhancement)
- Add optional `physical_elements` section to current format
- Include component positions
- Include via/pad locations with net associations
- Maintains backward compatibility

### Phase 3: Internal Node-Centric for AI (For Troubleshooting)
- Build node-centric structure internally for AI analysis
- Pass to AI troubleshooting feature
- Don't expose in export (unless user requests it)

### Phase 4: Dual Export (Future)
- Add "Export PCB Layout (JSON)" option
- Provides full node-centric format with physical data
- Separate from "Export Netlist (JSON)" for EDA tools

## Validation Considerations

### Current Format Validation
```typescript
function validateNetlist(netlist: any): string[] {
  const errors: string[] = [];
  
  // 1. Every component in nets must exist in components
  for (const net of netlist.nets) {
    for (const conn of net.connections) {
      const comp = netlist.components.find(c => c.designator === conn.component);
      if (!comp) {
        errors.push(`Net "${net.name}": Component "${conn.component}" not found`);
      } else {
        // 2. Pin number must be valid
        const pin = comp.pins.find(p => p.number === conn.pin_number);
        if (!pin) {
          errors.push(`Net "${net.name}": Pin ${conn.pin_number} not found on ${conn.component}`);
        }
      }
    }
  }
  
  // 3. Warn about nets with <2 connections
  for (const net of netlist.nets) {
    if (net.connections.length < 2) {
      errors.push(`Warning: Net "${net.name}" has only ${net.connections.length} connection(s)`);
    }
  }
  
  return errors;
}
```

### Node-Centric Format Validation
```typescript
function validateNodeCentricNetlist(netlist: any): string[] {
  const errors: string[] = [];
  
  // 1. Every component pin must reference a node_id
  for (const comp of netlist.components) {
    for (const pin of comp.pins) {
      if (!pin.node_id) {
        errors.push(`${comp.designator} pin ${pin.number} has no node_id`);
      } else if (!netlist.nodes[pin.node_id]) {
        errors.push(`${comp.designator} pin ${pin.number} references undefined node ${pin.node_id}`);
      }
    }
  }
  
  // 2. Bidirectional reference validation
  for (const [nodeId, node] of Object.entries(netlist.nodes)) {
    for (const conn of node.connections) {
      if (conn.type === 'component_pin') {
        const comp = netlist.components.find(c => c.designator === conn.ref);
        if (!comp) {
          errors.push(`Node ${nodeId} references undefined component ${conn.ref}`);
        } else {
          const pin = comp.pins.find(p => p.number === conn.pin);
          if (!pin) {
            errors.push(`Node ${nodeId} references undefined pin ${conn.pin} on ${conn.ref}`);
          } else if (pin.node_id !== nodeId) {
            errors.push(`Bidirectional reference mismatch: Node ${nodeId} -> ${conn.ref}:${conn.pin}, but pin references ${pin.node_id}`);
          }
        }
      }
    }
  }
  
  // 3. Physical element validation
  for (const via of netlist.physical_elements.vias) {
    if (!netlist.nodes[via.node_id]) {
      errors.push(`Via ${via.id} references undefined node ${via.node_id}`);
    }
  }
  
  return errors;
}
```

## Conclusion

**Recommendation: Hybrid Approach (Option 2)**

1. **Keep current net-centric format** as primary export
   - Industry standard
   - EDA tool compatible
   - Optimized for schematic generation

2. **Add optional physical_elements section** to current format
   - Component positions
   - Via/pad locations with net associations
   - Trace paths (optional)
   - Maintains backward compatibility

3. **Build node-centric structure internally** for AI troubleshooting
   - Use for AI analysis
   - Don't expose in standard export
   - Provides all benefits without format change

4. **Future: Add separate "Export PCB Layout"** option
   - Full node-centric format
   - For advanced use cases
   - Doesn't replace standard netlist export

This approach provides:
- ✅ Industry compatibility (current format)
- ✅ Physical data for troubleshooting (optional section)
- ✅ AI analysis capabilities (internal structure)
- ✅ No breaking changes
- ✅ Future extensibility (separate PCB layout export)
