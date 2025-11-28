# Schematic Net Optimization: Reducing Labels and Using Direct Wire Connections

## Goal

Reduce the number of net labels in KiCad schematics by maximizing direct wire connections between components, following KiCad best practices for cleaner, more readable schematics.

## Strategy

### Before Optimization
- **Every net received a label** - Even when all pins were directly connected with wires
- Result: Cluttered schematics with unnecessary labels
- Example: A net with 3 components all connected with wires would still get a "N$1" label

### After Optimization
- **Labels only when necessary**:
  1. **Power/Ground nets** - Always labeled for clarity (e.g., "+5V", "GND")
  2. **Single-pin nets** - Need labels since they can't be wired
  3. **Disconnected pins** - If not all pins in a net are connected via wires, add a label
  4. **Fully wired nets** - No label needed if all pins are connected with wires

## Implementation Details

### Wire Connection Algorithm
1. **Build connection graph** from PCB traces
2. **Use Minimum Spanning Tree (MST)** to connect all pins with minimum wire length
3. **Track connected pins** to determine if all pins are wired
4. **Add labels only when needed** based on connection status

### Label Decision Logic

```typescript
const allPinsConnected = pinPositions.length >= 2 && connectedPins.size === pinPositions.length;
const needsLabel = 
  // Power/ground nets: always label for clarity
  net.hasPower || net.hasGround ||
  // Single-pin nets: need label since they can't be wired
  pinPositions.length === 1 ||
  // Nets with disconnected pins
  (pinPositions.length >= 2 && !allPinsConnected);
```

### Benefits

1. **Cleaner Schematics**: Fewer labels = easier to read
2. **Better Wire Routing**: Direct connections show actual signal paths
3. **KiCad Best Practices**: Follows standard schematic conventions
4. **Reduced Clutter**: Only essential labels remain

## Examples

### Example 1: Fully Connected Net (No Label)
```
R1-1 ----[wire]---- R2-1 ----[wire]---- R3-1
```
All three resistors are connected with wires. **No label needed.**

### Example 2: Power Net (Label Required)
```
+5V [label]
  |
[wire]
  |
U1-VCC
```
Power nets are always labeled for clarity.

### Example 3: Single Pin (Label Required)
```
TP1 [label: "TEST"]
```
Single-pin nets (test points, etc.) need labels.

### Example 4: Partially Connected (Label Required)
```
R1-1 ----[wire]---- R2-1
R3-1 [label: "N$1"]  (not directly connected)
```
If R3-1 can't be directly wired to R1/R2, a label is used.

## Code Location

- **File**: `src/utils/schematic.ts`
- **Function**: `generateSimpleSchematic()`
- **Key Sections**:
  - Wire routing: Lines ~2096-2182
  - Label decision: Lines ~2204-2230

## Future Enhancements

1. **Orthogonal Routing**: Use Manhattan (orthogonal) routing for wires (KiCad preference)
2. **Global Labels**: For nets that span multiple sheets (hierarchical schematics)
3. **Bus Connections**: Group related signals into buses
4. **Junction Optimization**: Minimize unnecessary junctions

## Testing

To verify the optimization:
1. Export a schematic with multiple nets
2. Check that only necessary labels appear
3. Verify all pins are connected with wires when possible
4. Confirm power/ground nets are still labeled

## Console Logging

The code logs when labels are skipped:
```
[Schematic] Net N$5: All 3 pins connected with wires, skipping label
```

This helps verify the optimization is working correctly.

