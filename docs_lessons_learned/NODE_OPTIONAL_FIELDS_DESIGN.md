# Node Optional Fields: Design and User Interaction

## The Questions

1. **How and when would optional fields be defined?**
2. **Do they differ depending on what the node is associated with?**
3. **How would the user set or get the values of those optional fields?**

## Question 1: How and When Are Optional Fields Defined?

### Option A: Manual User Entry (Dialog-Based)
**When**: User right-clicks on a node (via, pad, test point) and selects "Edit Node Properties"

```typescript
interface NodePropertiesDialog {
  nodeId: string;
  netName: string;  // Read-only, derived from connectivity
  
  // User-editable fields
  notes?: string;
  criticality?: 'low' | 'medium' | 'high';
  signal_type?: 'digital' | 'analog' | 'power' | 'ground';
  function?: string;
}
```

**Pros:**
- ✅ User has full control
- ✅ Can add context and domain knowledge
- ✅ Simple to implement

**Cons:**
- ⚠️ Requires manual effort for every node
- ⚠️ Time-consuming for large boards
- ⚠️ User may not know what to enter

### Option B: Automatic Inference (AI/Heuristic)
**When**: During netlist generation, automatically infer from context

```typescript
function inferNodeProperties(node: NetlistNode, net: Net): NodeProperties {
  const properties: NodeProperties = {};
  
  // Infer signal_type from net name and connections
  if (net.name === 'GND' || net.name.includes('GROUND')) {
    properties.signal_type = 'ground';
    properties.criticality = 'high';
  } else if (net.name.startsWith('+') || net.name.startsWith('-')) {
    properties.signal_type = 'power';
    properties.criticality = 'high';
  } else if (hasHighSpeedComponents(node)) {
    properties.signal_type = 'digital';
  } else {
    properties.signal_type = 'analog';
  }
  
  // Infer criticality from component types
  if (connectsToMicrocontroller(node) || connectsToPowerSupply(node)) {
    properties.criticality = 'high';
  }
  
  // Infer function from connected components
  if (connectsToOscillatorComponents(node)) {
    properties.function = 'oscillator';
  }
  
  return properties;
}
```

**Pros:**
- ✅ No manual effort required
- ✅ Consistent across all nodes
- ✅ Works for large boards

**Cons:**
- ⚠️ May be inaccurate
- ⚠️ Requires complex heuristics
- ⚠️ User can't override easily

### Option C: Hybrid (Auto-Infer + User Override)
**When**: Auto-infer during export, allow user to edit before/after

```typescript
// Step 1: Auto-infer during netlist generation
const inferredProperties = inferNodeProperties(node, net);

// Step 2: Check for user overrides
const userOverrides = getUserNodeOverrides(node.id);

// Step 3: Merge (user overrides take precedence)
const finalProperties = { ...inferredProperties, ...userOverrides };
```

**Pros:**
- ✅ Good defaults automatically
- ✅ User can refine as needed
- ✅ Scales to large boards

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Need storage for user overrides

### Option D: Template-Based (Component-Driven)
**When**: Derive from component definitions and pin properties

```typescript
// Component definition includes pin metadata
{
  "componentType": "IntegratedCircuit",
  "partNumber": "SN74AC14",
  "pins": [
    {
      "number": "1",
      "name": "1A",
      "type": "input",
      "signal_type": "digital",  // Pin-level metadata
      "function": "schmitt_trigger_input"
    },
    {
      "number": "7",
      "name": "GND",
      "type": "power",
      "signal_type": "ground",
      "criticality": "high"
    }
  ]
}

// Node inherits properties from connected pins
function deriveNodeProperties(node: NetlistNode): NodeProperties {
  const connectedPins = getConnectedPins(node);
  
  // If any connected pin is power/ground, node is power/ground
  const powerPins = connectedPins.filter(p => p.type === 'power');
  if (powerPins.length > 0) {
    return {
      signal_type: powerPins[0].signal_type,
      criticality: 'high',
      function: powerPins[0].name
    };
  }
  
  // For signal pins, use majority vote or first pin
  const signalTypes = connectedPins.map(p => p.signal_type);
  return {
    signal_type: mostCommon(signalTypes),
    criticality: 'medium'
  };
}
```

**Pros:**
- ✅ Accurate (based on component datasheets)
- ✅ Reusable across projects
- ✅ No per-node manual entry

**Cons:**
- ⚠️ Requires rich component definitions
- ⚠️ We don't currently have pin-level metadata
- ⚠️ Significant upfront work

### **Recommendation: Start with Option C (Hybrid)**

**Phase 1**: Simple auto-inference
- `signal_type`: From net name (GND, +5V, etc.)
- `criticality`: Power/ground = high, others = medium
- `function`: Empty (user can add later)
- `notes`: Empty

**Phase 2**: Add user override UI
- Right-click on via/pad/test point → "Edit Node Properties"
- Dialog shows auto-inferred values
- User can override any field
- Store overrides in project data

**Phase 3**: Enhanced inference
- Use component types to refine signal_type
- Detect oscillators, regulators, etc. for function
- Use AI to suggest properties

## Question 2: Do Fields Differ by Node Association?

### Analysis: What Determines Node Properties?

#### Factor 1: Net Type
```typescript
// Power nets
{
  "signal_type": "power",
  "criticality": "high",
  "expected_voltage": {"nominal": 5.0, "min": 4.75, "max": 5.25}
}

// Ground nets
{
  "signal_type": "ground",
  "criticality": "high",
  "expected_voltage": {"nominal": 0.0, "min": -0.1, "max": 0.1}
}

// Signal nets
{
  "signal_type": "digital" | "analog",
  "criticality": "low" | "medium",
  "expected_voltage": {"min": 0.0, "max": 5.0}  // Range, not specific
}
```

#### Factor 2: Connected Components
```typescript
// Node connected to microcontroller pins
{
  "signal_type": "digital",
  "criticality": "high",  // MCU pins are critical
  "function": "mcu_gpio"
}

// Node connected to passive components only (R-C filter)
{
  "signal_type": "analog",
  "criticality": "low",
  "function": "rc_filter"
}

// Node connected to voltage regulator output
{
  "signal_type": "power",
  "criticality": "high",
  "function": "regulated_supply",
  "expected_voltage": {"nominal": 3.3, "min": 3.15, "max": 3.45}
}
```

#### Factor 3: Physical Location (Test Points)
```typescript
// Node with test point
{
  "test_point_id": "TP1",
  "criticality": "medium",  // User wants to measure this
  "notes": "Key measurement point for troubleshooting"
}

// Node without test point (buried via)
{
  "test_point_id": null,
  "notes": "Internal connection, not accessible"
}
```

### Proposed Field Applicability Matrix

| Field | Power Nodes | Ground Nodes | Signal Nodes | Notes |
|-------|-------------|--------------|--------------|-------|
| `signal_type` | ✅ "power" | ✅ "ground" | ✅ "digital"/"analog" | Always applicable |
| `criticality` | ✅ Always "high" | ✅ Always "high" | ✅ "low"/"medium"/"high" | Context-dependent |
| `expected_voltage` | ✅ Specific value | ✅ ~0V | ✅ Range | Different semantics |
| `function` | ✅ "3v3_rail" | ✅ "chassis_ground" | ✅ "clock"/"data" | Descriptive |
| `notes` | ✅ User notes | ✅ User notes | ✅ User notes | Always applicable |
| `test_point_id` | ✅ If accessible | ✅ If accessible | ✅ If accessible | Physical property |
| `impedance` | ❌ N/A | ❌ N/A | ✅ For RF/high-speed | Signal-specific |
| `frequency_range` | ❌ DC only | ❌ DC only | ✅ For AC signals | Signal-specific |
| `related_nodes` | ✅ Other power rails | ✅ Other grounds | ✅ Differential pairs | Context-dependent |

### **Recommendation: Universal Fields with Context-Specific Defaults**

All nodes have the same optional fields, but defaults and typical values differ:

```typescript
interface NodeOptionalFields {
  // Universal fields (all node types)
  notes?: string;                    // User notes
  criticality?: 'low' | 'medium' | 'high';
  signal_type?: 'digital' | 'analog' | 'power' | 'ground';
  function?: string;                 // Descriptive name
  test_point_id?: string;            // Link to test point
  related_nodes?: string[];          // Associated nodes
  
  // Signal-specific fields (optional, typically empty for power/ground)
  impedance?: ImpedanceSpec;         // For RF/high-speed
  frequency_range?: FrequencyRange;  // For AC signals
  standards?: string[];              // USB, I2C, SPI, etc.
}

// Context-specific defaults
function getDefaultNodeFields(netType: string): Partial<NodeOptionalFields> {
  if (netType === 'power') {
    return {
      signal_type: 'power',
      criticality: 'high'
    };
  } else if (netType === 'ground') {
    return {
      signal_type: 'ground',
      criticality: 'high'
    };
  } else {
    return {
      signal_type: 'analog',  // Default, can be refined
      criticality: 'medium'
    };
  }
}
```

## Question 3: How Would Users Set/Get Values?

### Setting Values: UI/UX Design

#### Approach A: Context Menu on Canvas
**User Action**: Right-click on via/pad/test point → "Edit Node Properties..."

```typescript
// Detect what user clicked
function handleCanvasRightClick(x: number, y: number) {
  const clickedElement = findElementAtPosition(x, y);
  
  if (clickedElement.type === 'via' || 
      clickedElement.type === 'pad' || 
      clickedElement.type === 'testPoint') {
    
    // Get the node ID for this element
    const nodeId = clickedElement.points[0]?.id;
    
    if (nodeId !== undefined) {
      // Show context menu
      showContextMenu([
        { label: 'Edit Node Properties...', action: () => openNodePropertiesDialog(nodeId) },
        { label: 'Add Test Point', action: () => addTestPointAtNode(nodeId) },
        // ... other options
      ]);
    }
  }
}
```

**Dialog Design**:
```typescript
interface NodePropertiesDialogProps {
  nodeId: number;
  netName: string;  // Derived from connectivity
  currentProperties: NodeOptionalFields;
  onSave: (properties: NodeOptionalFields) => void;
  onCancel: () => void;
}

// Dialog shows:
// - Node ID (read-only)
// - Net Name (read-only)
// - Signal Type (dropdown: digital/analog/power/ground)
// - Criticality (dropdown: low/medium/high)
// - Function (text input)
// - Notes (multiline text area)
// - Test Point (dropdown: existing test points or "None")
// - Related Nodes (multi-select: other nodes in project)
```

**Pros:**
- ✅ Intuitive (right-click on element)
- ✅ Direct manipulation
- ✅ Visual feedback on canvas

**Cons:**
- ⚠️ Requires clicking on specific element (via/pad)
- ⚠️ Can't edit nodes without physical elements

#### Approach B: Node List Panel
**User Action**: Open "Nodes" panel, select node from list, edit properties

```typescript
// New panel in sidebar
interface NodesPanel {
  nodes: Array<{
    id: string;
    netName: string;
    type: 'via' | 'pad' | 'component_pin' | 'trace_point';
    properties: NodeOptionalFields;
  }>;
  
  // Filters
  filterByNet?: string;
  filterByType?: string;
  filterByCriticality?: string;
  
  // Actions
  onSelectNode: (nodeId: string) => void;  // Highlight on canvas
  onEditNode: (nodeId: string) => void;    // Open properties dialog
}
```

**Pros:**
- ✅ Can see all nodes at once
- ✅ Can filter and search
- ✅ Can batch edit
- ✅ Can edit nodes without physical elements

**Cons:**
- ⚠️ More UI complexity
- ⚠️ Disconnected from visual representation
- ⚠️ Another panel to manage

#### Approach C: Net Properties Dialog (Bulk Edit)
**User Action**: Edit net properties, which applies to all nodes in that net

```typescript
// Extend existing net properties dialog
interface NetPropertiesDialog {
  netName: string;
  netType: 'power' | 'ground' | 'signal';
  
  // Apply to all nodes in this net
  defaultNodeProperties: {
    signal_type: 'digital' | 'analog' | 'power' | 'ground';
    criticality: 'low' | 'medium' | 'high';
    function?: string;
    notes?: string;
  };
}
```

**Pros:**
- ✅ Efficient for nets with many nodes
- ✅ Consistent properties across net
- ✅ Simple UI

**Cons:**
- ⚠️ Can't customize individual nodes
- ⚠️ Less granular control
- ⚠️ Doesn't leverage node-level flexibility

#### Approach D: Inline Editing (Hover/Tooltip)
**User Action**: Hover over via/pad, see properties in tooltip, click to edit

```typescript
// Show tooltip on hover
function handleCanvasHover(x: number, y: number) {
  const element = findElementAtPosition(x, y);
  
  if (element && element.nodeId) {
    const nodeProperties = getNodeProperties(element.nodeId);
    
    showTooltip({
      position: { x, y },
      content: `
        Node: ${element.nodeId}
        Net: ${nodeProperties.netName}
        Type: ${nodeProperties.signal_type || 'unknown'}
        Criticality: ${nodeProperties.criticality || 'medium'}
        [Click to edit]
      `
    });
  }
}
```

**Pros:**
- ✅ Quick access
- ✅ No context menu needed
- ✅ Visual feedback

**Cons:**
- ⚠️ Can be cluttered with many elements
- ⚠️ Hover state can be unstable
- ⚠️ Hard to edit complex properties

### **Recommendation: Hybrid Approach**

**Primary Method**: Context menu on canvas (Approach A)
- Right-click via/pad/test point → "Edit Node Properties..."
- Opens dialog with all optional fields
- Most intuitive for users

**Secondary Method**: Inline tooltip (Approach D)
- Hover shows current properties
- Quick view without opening dialog
- Click tooltip to open full dialog

**Future Enhancement**: Nodes panel (Approach B)
- For power users who want to see all nodes
- Useful for large boards
- Can be added later if needed

### Getting Values: Where Are They Stored?

#### Storage Location 1: In Project Data (Recommended)
```typescript
// Add to project data structure
interface ProjectData {
  // ... existing fields ...
  
  nodeProperties: Map<number, NodeOptionalFields>;  // nodeId → properties
}

// Save with project
function saveProject() {
  const projectData = {
    // ... existing data ...
    nodeProperties: Object.fromEntries(nodePropertiesMap)
  };
  
  // Save to project.json
}

// Load with project
function loadProject(data: any) {
  // ... existing loading ...
  
  if (data.nodeProperties) {
    nodePropertiesMap = new Map(Object.entries(data.nodeProperties));
  }
}
```

**Pros:**
- ✅ Persisted with project
- ✅ Version controlled
- ✅ Survives app restart

**Cons:**
- ⚠️ Increases project file size
- ⚠️ Need to handle migration

#### Storage Location 2: In Netlist Export Only
```typescript
// Generate properties during export
function generateNetlist() {
  const nodes = buildNodes();
  
  // Add properties to each node
  for (const node of nodes) {
    node.properties = {
      ...inferNodeProperties(node),  // Auto-infer
      ...getUserOverrides(node.id)   // User overrides (if any)
    };
  }
  
  return { nets, nodes };
}
```

**Pros:**
- ✅ No project file bloat
- ✅ Properties generated fresh each time

**Cons:**
- ⚠️ User overrides lost if not stored somewhere
- ⚠️ Inconsistent between exports

### **Recommendation: Store in Project Data**

```typescript
// Add to App.tsx state
const [nodeProperties, setNodeProperties] = useState<Map<number, NodeOptionalFields>>(new Map());

// Persist in project.json
function buildProjectData() {
  return {
    // ... existing fields ...
    nodeProperties: Object.fromEntries(nodeProperties)
  };
}

// Restore on load
function loadProject(data: any) {
  // ... existing loading ...
  
  if (data.nodeProperties) {
    setNodeProperties(new Map(
      Object.entries(data.nodeProperties).map(([k, v]) => [parseInt(k), v])
    ));
  }
}
```

## Implementation Plan

### Phase 1: Data Structure and Storage
```typescript
// 1. Define types
interface NodeOptionalFields {
  notes?: string;
  criticality?: 'low' | 'medium' | 'high';
  signal_type?: 'digital' | 'analog' | 'power' | 'ground';
  function?: string;
  test_point_id?: string;
  related_nodes?: string[];
}

// 2. Add state to App.tsx
const [nodeProperties, setNodeProperties] = useState<Map<number, NodeOptionalFields>>(new Map());

// 3. Add to project save/load
// (see above)
```

### Phase 2: Auto-Inference
```typescript
// Simple inference based on net name
function inferNodeProperties(nodeId: number, netName: string): NodeOptionalFields {
  if (netName === 'GND' || netName.toUpperCase().includes('GROUND')) {
    return {
      signal_type: 'ground',
      criticality: 'high'
    };
  }
  
  if (netName.startsWith('+') || netName.startsWith('-')) {
    return {
      signal_type: 'power',
      criticality: 'high'
    };
  }
  
  return {
    signal_type: 'analog',
    criticality: 'medium'
  };
}
```

### Phase 3: UI for Editing
```typescript
// 1. Add context menu option
function handleCanvasRightClick(e: React.MouseEvent) {
  const element = findElementAtPosition(x, y);
  
  if (element?.nodeId) {
    showContextMenu([
      {
        label: 'Edit Node Properties...',
        action: () => openNodePropertiesDialog(element.nodeId)
      }
    ]);
  }
}

// 2. Create NodePropertiesDialog component
<NodePropertiesDialog
  nodeId={selectedNodeId}
  netName={getNetName(selectedNodeId)}
  currentProperties={nodeProperties.get(selectedNodeId) || {}}
  onSave={(props) => {
    setNodeProperties(prev => new Map(prev).set(selectedNodeId, props));
  }}
  onClose={() => setNodePropertiesDialogVisible(false)}
/>
```

### Phase 4: Export Integration
```typescript
// Include properties in netlist export
function generatePadsNetlist() {
  // ... build nodes ...
  
  for (const node of nodes) {
    // Get user overrides or infer
    const userProps = nodeProperties.get(node.id);
    const inferredProps = inferNodeProperties(node.id, netName);
    
    // Merge (user overrides take precedence)
    node.properties = { ...inferredProps, ...userProps };
  }
  
  // ... continue export ...
}
```

## Summary and Recommendations

### Question 1: How and When?
**Answer**: Hybrid approach
- **Auto-infer** during netlist generation (based on net name, component types)
- **User can override** via dialog (stored in project data)
- **Merged at export** (user overrides take precedence)

### Question 2: Do They Differ?
**Answer**: Universal fields with context-specific defaults
- All nodes have same optional fields
- Defaults differ by net type (power/ground/signal)
- Some fields more relevant for certain node types (e.g., impedance for signals)
- But all fields available for all nodes (flexibility)

### Question 3: How to Set/Get?
**Answer**: Context menu + project storage
- **Set**: Right-click via/pad/test point → "Edit Node Properties..." → Dialog
- **Get**: Hover tooltip shows current properties
- **Store**: In project data (persisted in project.json)
- **Export**: Merge auto-inferred + user overrides

### Implementation Priority

**High Priority** (Essential for hybrid netlist):
1. ✅ Define `NodeOptionalFields` interface
2. ✅ Add `nodeProperties` state to App.tsx
3. ✅ Add to project save/load
4. ✅ Simple auto-inference (net name based)
5. ✅ Include in netlist export

**Medium Priority** (User convenience):
6. ⚠️ NodePropertiesDialog component
7. ⚠️ Context menu integration
8. ⚠️ Hover tooltip display

**Low Priority** (Advanced features):
9. 📋 Enhanced inference (component-based)
10. 📋 Nodes panel for bulk editing
11. 📋 AI-suggested properties

**Shall we proceed with implementing Phase 1 (data structure and storage)?**
