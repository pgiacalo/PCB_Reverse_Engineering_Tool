// ============================================================================
// Simple Schematic Generator
// ============================================================================
// Generates a simple KiCad schematic from netlist data
// Focuses on showing connections, not conforming to KiCad conventions

import type { PCBComponent, DrawingStroke, GroundSymbol } from '../types';
import { 
  buildConnectivityGraph, 
  groupNodesIntoNets, 
  generateNetNames, 
  type NetlistNode 
} from './netlist';

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

interface Net {
  name: string;
  componentPins: Array<{ designator: string; pin: number }>;
  hasPower: boolean;
  hasGround: boolean;
  powerVoltage?: string;
  viaCount: number;
  tracePointCount: number;
}

/**
 * Get component value for schematic generation
 * Prioritizes actual component values (resistance, capacitance, etc.) over generic types
 * For passive components: uses resistance/capacitance/inductance
 * For active components: uses partNumber or partName
 * Falls back to componentType if no specific value is available
 */
function getComponentValueForSchematic(comp: PCBComponent): string {
  // For Resistor: use resistance
  if (comp.componentType === 'Resistor' && 'resistance' in comp) {
    const resistance = (comp as any).resistance?.trim();
    if (resistance && resistance !== '') {
      return resistance;
    }
  }
  
  // For Capacitor: use capacitance
  if (comp.componentType === 'Capacitor' && 'capacitance' in comp) {
    const capacitance = (comp as any).capacitance?.trim();
    if (capacitance && capacitance !== '') {
      return capacitance;
    }
  }
  
  // For Electrolytic Capacitor: use capacitance
  if (comp.componentType === 'Electrolytic Capacitor' && 'capacitance' in comp) {
    const capacitance = (comp as any).capacitance?.trim();
    if (capacitance && capacitance !== '') {
      return capacitance;
    }
  }
  
  // For Inductor: use inductance
  if (comp.componentType === 'Inductor' && 'inductance' in comp) {
    const inductance = (comp as any).inductance?.trim();
    if (inductance && inductance !== '') {
      return inductance;
    }
  }
  
  // For ICs, Transistors, Diodes, and other active components: use partNumber or partName
  const partName = (comp as any).partName?.trim();
  if (partName && partName !== '') {
    return partName;
  }
  
  const partNumber = (comp as any).partNumber?.trim();
  if (partNumber && partNumber !== '') {
    return partNumber;
  }
  
  // Fallback to componentType
  return comp.componentType;
}

/**
 * Generate a simple KiCad schematic that shows component connections
 * Uses generic symbols and simple wire connections
 */
export function generateSimpleSchematic(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): string {
  // Build connectivity using Node ID-based matching
  const nodes = buildConnectivityGraph(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses
  );

  // Debug: Check component pin nodes
  const componentPinNodes = Array.from(nodes.values()).filter(n => n.type === 'component_pin');
  console.log(`[Schematic] Component pin nodes in graph: ${componentPinNodes.length}`);
  if (componentPinNodes.length > 0) {
    console.log(`[Schematic] Sample component pin nodes:`, componentPinNodes.slice(0, 5).map(n =>
      `Node ID ${n.id} (compId: ${n.componentId}, pinIndex: ${n.pinIndex})`
    ));
  }

  // Build connections from traces (Node ID-based)
  // Nodes with the same Node ID are already the same node in the map (same key)
  // We only need to connect nodes with different Node IDs through trace paths
  const connections: Array<[number, number]> = [];

  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        if (point1 && point2 && point1.id !== undefined && point2.id !== undefined) {
          // Connect consecutive points by their Node IDs
          // If point1.id === point2.id, they're already the same node (no connection needed)
          if (point1.id !== point2.id) {
            connections.push([point1.id, point2.id]);
          }
        }
      }
    }
  }

  console.log(`[Schematic] Trace connections: ${connections.length} (connecting nodes with different Node IDs)`);
  
  // Note: Nodes with the same Node ID are automatically the same node in the map
  // This means:
  // - If a via has Node ID 5 and a trace point also has Node ID 5, they're the same node
  // - If a component pin references Node ID 5, it's connected to that same node
  // - No coordinate-based matching needed - Node ID is the source of truth

  // Note: Points with the same Node ID are already the same node in the nodes map.
  // The union-find algorithm will group connected nodes together.

  const netGroups = groupNodesIntoNets(nodes, connections);
  const netNames = generateNetNames(netGroups, nodes);
  
  console.log(`[Schematic] Net groups created: ${netGroups.size}`);
  
  // Check which component pins are in nets vs isolated (after netGroups is created)
  if (componentPinNodes.length > 0) {
    const isolatedPins: Array<{ compId: string; designator: string; pinIndex: number; nodeId: number }> = [];
    
    for (const node of componentPinNodes) {
      // Check if this node ID appears in any net group
      let foundInNet = false;
      for (const [, netNodes] of netGroups) {
        if (netNodes.some(n => n.id === node.id)) {
          foundInNet = true;
          break;
        }
      }
      if (!foundInNet) {
        const comp = components.find(c => c.id === node.componentId);
        const designator = comp ? ((comp as any).abbreviation?.trim() || comp.designator?.trim() || 'UNKNOWN') : 'UNKNOWN';
        isolatedPins.push({
          compId: node.componentId || 'unknown',
          designator,
          pinIndex: node.pinIndex || 0,
          nodeId: node.id
        });
      }
    }
    
    if (isolatedPins.length > 0) {
      console.warn(`[Schematic] Found ${isolatedPins.length} isolated component pins (not in any net):`);
      for (const pin of isolatedPins.slice(0, 10)) { // Show first 10
        console.warn(`  - ${pin.designator} pin ${pin.pinIndex + 1} at Node ID ${pin.nodeId}`);
      }
    } else {
      console.log(`[Schematic] All component pins are in nets`);
    }
  }
  
  // Build component ID to designator map (used for both nets and component layout)
  // Prioritize designator (full name like "R1", "C2") over abbreviation (just prefix like "R", "C")
  const componentIdToDesignator = new Map<string, string>();
  for (const comp of components) {
    // Prefer designator (full name with number) over abbreviation (just prefix)
    // Filter out placeholders like "?", "??", "****", "*"
    let designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
    
    // Filter out placeholder values
    if (designator && (designator === '?' || designator === '??' || designator === '***' || designator === '****' || designator === '*')) {
      designator = ''; // Treat placeholders as empty
    }
    
    // Only use designator if it's valid (not empty, not just a single letter without number)
    // Allow single letters as fallback, but prefer full designators
    if (designator && designator.length > 0) {
      componentIdToDesignator.set(comp.id, designator);
      console.log(`[Schematic] Mapped component ${comp.id} to designator "${designator}"`);
    } else {
      console.warn(`[Schematic] Component ${comp.id} (type: ${comp.componentType}) has no valid designator`);
    }
  }
  
  console.log(`[Schematic] Component ID to designator map: ${componentIdToDesignator.size} components`);

  // Build nets with component pin connections
  const nets: Net[] = [];
  let totalNetGroups = 0;
  let totalComponentPinsFound = 0;
  const componentPinNodesByNet = new Map<number, NetlistNode[]>();
  
  // First pass: collect all component pin nodes by their net root
  for (const [rootNodeId, netNodes] of netGroups) {
    totalNetGroups++;
    const componentPinsInNet: NetlistNode[] = [];

    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        componentPinsInNet.push(node);
        totalComponentPinsFound++;
      }
    }

    if (componentPinsInNet.length > 0) {
      componentPinNodesByNet.set(rootNodeId, componentPinsInNet);
    }
  }

  // Second pass: build nets from ALL net groups (not just those with component pins)
  // Include power, ground, vias, trace points, and component pins
  for (const [rootNodeId, netNodes] of netGroups) {
    const netName = netNames.get(rootNodeId) || `N$${rootNodeId}`;
    const componentPins: Array<{ designator: string; pin: number }> = [];
    
    // Check for power and ground nodes in this net
    let hasPower = false;
    let hasGround = false;
    let powerVoltage: string | undefined;
    let viaCount = 0;
    let tracePointCount = 0;
    
    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        const designator = componentIdToDesignator.get(node.componentId);
        if (designator) {
          componentPins.push({ designator, pin: (node.pinIndex || 0) + 1 });
        } else {
          // Try to find the component and log more details
          const comp = components.find(c => c.id === node.componentId);
          const compDesignator = comp ? (comp.designator?.trim() || (comp as any).abbreviation?.trim() || 'NONE') : 'NOT_FOUND';
          console.warn(`[Schematic] Component pin found but no designator in map for componentId: ${node.componentId}, component designator: "${compDesignator}", node: Node ID ${node.id}, pinIndex: ${node.pinIndex}`);
        }
      } else if (node.type === 'power') {
        hasPower = true;
        powerVoltage = node.voltage || powerVoltage;
      } else if (node.type === 'ground') {
        hasGround = true;
      } else if (node.type === 'via') {
        viaCount++;
      } else if (node.type === 'trace_point') {
        tracePointCount++;
      }
    }
    
    // Include ALL nets, even if they have only 1 component pin or no component pins
    // This ensures power/ground nets and single connections are shown
    nets.push({ 
      name: netName, 
      componentPins,
      hasPower,
      hasGround,
      powerVoltage,
      viaCount,
      tracePointCount
    });
  }
  
  // Debug: log net information
  console.log(`[Schematic] Total net groups: ${totalNetGroups}, Component pins found: ${totalComponentPinsFound}`);
  console.log(`[Schematic] Nets with component pins: ${componentPinNodesByNet.size}`);
  console.log(`[Schematic] Generated ${nets.length} total nets (including power/ground and single-pin connections)`);
  
  const netsWith2PlusPins = nets.filter(n => n.componentPins.length >= 2).length;
  const powerNets = nets.filter(n => n.hasPower).length;
  const groundNets = nets.filter(n => n.hasGround).length;
  console.log(`[Schematic] - ${netsWith2PlusPins} nets with 2+ component pins`);
  console.log(`[Schematic] - ${powerNets} power nets`);
  console.log(`[Schematic] - ${groundNets} ground nets`);
  
  // Show details of nets with component pins
  if (componentPinNodesByNet.size > 0) {
    console.log(`[Schematic] Sample nets with component pins:`);
    let count = 0;
    for (const [rootNodeId, componentPinNodes] of componentPinNodesByNet) {
      if (count++ >= 5) break; // Show first 5
      const netName = netNames.get(rootNodeId) || `N$${rootNodeId}`;
      const pinDetails = componentPinNodes.map(n => {
        const designator = componentIdToDesignator.get(n.componentId!);
        return `${designator || 'unknown'}:pin${(n.pinIndex || 0) + 1}@NodeID${n.id}`;
      });
      console.log(`  Net ${netName} (root Node ID ${rootNodeId}): ${componentPinNodes.length} pins - ${pinDetails.join(', ')}`);
    }
  }
  
  if (nets.length > 0) {
    console.log(`[Schematic] First net: ${nets[0].name} with ${nets[0].componentPins.length} pins:`, nets[0].componentPins);
  } else {
    console.warn(`[Schematic] No nets with 2+ component pins found! Each component pin is in its own net.`);
    console.warn(`[Schematic] This suggests component pins are not connected through traces/vias.`);
  }

  // Build component map for layout
  const componentMap = new Map<string, { comp: PCBComponent; designator: string; x: number; y: number }>();

  // Layout components in a grid
  // Include all components that have designators (prioritize designator over abbreviation)
  const componentsWithDesignators = components.filter(c => {
    let d = c.designator?.trim() || (c as any).abbreviation?.trim();
    // Filter out placeholder values
    if (d && (d === '?' || d === '??' || d === '***' || d === '****' || d === '*')) {
      d = ''; // Treat placeholders as empty
    }
    return !!d && d.length > 0; // Must have a non-empty designator
  });

  // Use PCB coordinates to preserve geometric relationships
  // Scale and translate PCB coordinates (pixels) to schematic coordinates (mm)
  if (componentsWithDesignators.length > 0) {
    // Find bounding box of all components
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const comp of componentsWithDesignators) {
      minX = Math.min(minX, comp.x);
      minY = Math.min(minY, comp.y);
      maxX = Math.max(maxX, comp.x);
      maxY = Math.max(maxY, comp.y);
    }
    
    // Calculate scale factor to fit components in reasonable schematic space
    // Target: fit in approximately 400mm x 400mm area (larger to reduce crowding)
    // A4 paper is ~210mm x 297mm, but we'll use a larger virtual canvas
    const pcbWidth = maxX - minX;
    const pcbHeight = maxY - minY;
    const targetSchematicWidth = 400; // mm (increased from 200mm)
    const targetSchematicHeight = 400; // mm (increased from 200mm)
    
    // Use the smaller scale factor to ensure everything fits
    const scaleX = pcbWidth > 0 ? targetSchematicWidth / pcbWidth : 0.2;
    const scaleY = pcbHeight > 0 ? targetSchematicHeight / pcbHeight : 0.2;
    const scale = Math.min(scaleX, scaleY, 0.2); // Cap at 0.2 (1 pixel = 0.2mm max) to allow more spacing
    
    // Offset to start at reasonable position (50mm margin for better spacing)
    const offsetX = 50;
    const offsetY = 50;
    
    // Map components using PCB coordinates
    for (const comp of componentsWithDesignators) {
      // Prioritize designator (full name like "R1") over abbreviation (just prefix like "R")
      let designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
      // Filter out placeholder values
      if (designator && (designator === '?' || designator === '??' || designator === '***' || designator === '****' || designator === '*')) {
        designator = ''; // Treat placeholders as empty
      }
      if (designator && designator.length > 0) {
        // Convert PCB coordinates to schematic coordinates
        // Translate to origin, scale, then offset
        const schematicX = (comp.x - minX) * scale + offsetX;
        const schematicY = (comp.y - minY) * scale + offsetY;
        
        componentMap.set(designator, { comp, designator, x: schematicX, y: schematicY });
      }
    }
  }

  // Generate KiCad schematic
  let schematic = '(kicad_sch (version 20201015) (generator simple_schematic)\n';
  schematic += '  (paper "A4")\n';
  schematic += '  (title_block\n';
  schematic += '    (title "")\n';
  schematic += '    (date "")\n';
  schematic += '    (rev "")\n';
  schematic += '    (company "")\n';
  schematic += '  )\n';
  schematic += '\n';

  // Add simple component symbols
  // Define a generic symbol with maximum pins (20) - instances can use any subset
  schematic += '  (lib_symbols\n';
  
  // Add power symbol (simplified - just a connection point with label)
  schematic += '    (symbol "simple:Power" (pin_names (offset 1.016)) (in_bom no) (on_board no)\n';
  schematic += '      (property "Reference" "#PWR" (id 0) (at 0 0 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)) hide)\n';
  schematic += '      )\n';
  schematic += '      (symbol "Power_0_1"\n';
  schematic += '        (polyline (pts (xy 0 0) (xy 0 -2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -1.27 0) (xy 1.27 0)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -0.635 -1.27) (xy 0.635 -1.27)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -0.3175 -1.905) (xy 0.3175 -1.905)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Add ground symbol (simplified - just a connection point with label)
  schematic += '    (symbol "simple:Ground" (pin_names (offset 1.016)) (in_bom no) (on_board no)\n';
  schematic += '      (property "Reference" "#PWR" (id 0) (at 0 0 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)) hide)\n';
  schematic += '      )\n';
  schematic += '      (symbol "Ground_0_1"\n';
  schematic += '        (polyline (pts (xy 0 0) (xy 0 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -2.54 2.54) (xy 2.54 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -1.27 3.81) (xy 1.27 3.81)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -0.635 4.445) (xy 0.635 4.445)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Resistor symbol (2 pins)
  schematic += '    (symbol "simple:Resistor" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "R" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Resistor_0_1"\n';
  schematic += '        (polyline (pts (xy -3.81 0) (xy -2.54 0) (xy -1.27 1.27) (xy 0 -1.27) (xy 1.27 1.27) (xy 2.54 -1.27) (xy 3.81 0)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (pin passive line (at -6.35 0 0) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 6.35 0 180) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Capacitor symbol (2 pins)
  schematic += '    (symbol "simple:Capacitor" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "C" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Capacitor_0_1"\n';
  schematic += '        (polyline (pts (xy 0 -2.54) (xy 0 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -2.54 -2.54) (xy -2.54 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy 2.54 -2.54) (xy 2.54 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (pin passive line (at -5.08 0 0) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 5.08 0 180) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Diode symbol (2 pins - triangle with line)
  schematic += '    (symbol "simple:Diode" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "D" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Diode_0_1"\n';
  schematic += '        (polyline (pts (xy -2.54 0) (xy 0 -2.54) (xy 0 2.54) (xy -2.54 0)) (stroke (width 0.254) (type default)) (fill (type background)))\n';
  schematic += '        (polyline (pts (xy 0 -2.54) (xy 0 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (pin passive line (at -5.08 0 0) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 5.08 0 180) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Switch symbol (SPST - single pole single throw)
  schematic += '    (symbol "simple:Switch" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "SW" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Switch_0_1"\n';
  schematic += '        (polyline (pts (xy -3.81 0) (xy -1.27 0)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy 1.27 0) (xy 3.81 0)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -1.27 -1.27) (xy 1.27 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (pin passive line (at -5.08 0 0) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 5.08 0 180) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Transistor symbol (NPN BJT)
  schematic += '    (symbol "simple:Transistor" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "Q" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Transistor_0_1"\n';
  schematic += '        (polyline (pts (xy 0 -2.54) (xy 0 0)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -2.54 0) (xy 0 0) (xy 2.54 0)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy 0 0) (xy 0 2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -1.27 -1.27) (xy 0 -2.54) (xy 1.27 -1.27)) (stroke (width 0.254) (type default)) (fill (type background)))\n';
  schematic += '        (pin passive line (at 0 -5.08 90) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at -3.81 0 0) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 3.81 0 180) (length 2.54)\n';
  schematic += '          (name "3" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "3" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Inductor symbol (coil)
  schematic += '    (symbol "simple:Inductor" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "L" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Inductor_0_1"\n';
  schematic += '        (arc (start -2.54 0) (mid -1.27 0) (end 0 0) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (arc (start 0 0) (mid 1.27 0) (end 2.54 0) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (pin passive line (at -5.08 0 0) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 5.08 0 180) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Battery symbol
  schematic += '    (symbol "simple:Battery" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "B" (id 0) (at 0 3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -3.81 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Battery_0_1"\n';
  schematic += '        (polyline (pts (xy -3.81 -1.27) (xy -3.81 1.27)) (stroke (width 0.508) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -1.27 -1.27) (xy -1.27 1.27)) (stroke (width 0.508) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy 1.27 -1.27) (xy 1.27 1.27)) (stroke (width 0.508) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy 3.81 -1.27) (xy 3.81 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (pin passive line (at -5.08 0 0) (length 2.54)\n';
  schematic += '          (name "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "1" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '        (pin passive line (at 5.08 0 180) (length 2.54)\n';
  schematic += '          (name "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '          (number "2" (effects (font (size 1.27 1.27))))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Integrated Circuit symbol (rectangular with configurable pins)
  schematic += '    (symbol "simple:IC" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "U" (id 0) (at 0 2.54 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -2.54 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "IC_0_1"\n';
  schematic += '        (rectangle (start -5.08 -3.81) (end 5.08 3.81)\n';
  schematic += '          (stroke (width 0.254)) (fill (type background))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '      (symbol "IC_1_1"\n';
  // Define 20 pins in the library symbol (left side 1-10, right side 11-20)
  for (let i = 0; i < 10; i++) {
    const pinNum = i + 1;
    const pinY = -((10 - 1) * 2.54 / 2) + (i * 2.54);
    const pinX = -5.08;
    schematic += `        (pin passive line (at ${pinX} ${pinY} 0) (length 2.54)\n`;
    schematic += `          (name "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += `          (number "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += '        )\n';
  }
  for (let i = 0; i < 10; i++) {
    const pinNum = i + 11;
    const pinY = -((10 - 1) * 2.54 / 2) + (i * 2.54);
    const pinX = 5.08;
    schematic += `        (pin passive line (at ${pinX} ${pinY} 180) (length 2.54)\n`;
    schematic += `          (name "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += `          (number "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += '        )\n';
  }
  schematic += '      )\n';
  schematic += '    )\n';
  
  // Generic symbol for other component types (fallback)
  schematic += '    (symbol "simple:Generic" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n';
  schematic += '      (property "Reference" "REF" (id 0) (at 0 2.54 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (property "Value" "VAL" (id 1) (at 0 -2.54 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)))\n';
  schematic += '      )\n';
  schematic += '      (symbol "Generic_0_1"\n';
  schematic += '        (rectangle (start -5.08 -3.81) (end 5.08 3.81)\n';
  schematic += '          (stroke (width 0.254)) (fill (type background))\n';
  schematic += '        )\n';
  schematic += '      )\n';
  schematic += '      (symbol "Generic_1_1"\n';
  // Define 20 pins in the library symbol (left side 1-10, right side 11-20)
  for (let i = 0; i < 10; i++) {
    const pinNum = i + 1;
    const pinY = -((10 - 1) * 2.54 / 2) + (i * 2.54);
    const pinX = -5.08;
    schematic += `        (pin passive line (at ${pinX} ${pinY} 0) (length 2.54)\n`;
    schematic += `          (name "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += `          (number "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += '        )\n';
  }
  for (let i = 0; i < 10; i++) {
    const pinNum = i + 11;
    const pinY = -((10 - 1) * 2.54 / 2) + (i * 2.54);
    const pinX = 5.08;
    schematic += `        (pin passive line (at ${pinX} ${pinY} 180) (length 2.54)\n`;
    schematic += `          (name "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += `          (number "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
    schematic += '        )\n';
  }
  schematic += '      )\n';
  schematic += '    )\n';
  schematic += '  )\n';
  schematic += '\n';

  // Place components
  let uuidCounter = 1;
  const generateUuid = () => {
    const uuid = `00000000-0000-0000-0000-${String(uuidCounter++).padStart(12, '0')}`;
    return uuid;
  };

  // Helper function to get symbol library ID based on component type
  const getSymbolLibId = (componentType: string): string => {
    switch (componentType) {
      case 'Resistor':
      case 'ResistorNetwork':
      case 'VariableResistor':
      case 'Thermistor':
        return 'simple:Resistor';
      case 'Capacitor':
      case 'Electrolytic Capacitor':
        return 'simple:Capacitor';
      case 'Diode':
      case 'ZenerDiode':
        return 'simple:Diode';
      case 'Switch':
        return 'simple:Switch';
      case 'Transistor':
        return 'simple:Transistor';
      case 'Inductor':
        return 'simple:Inductor';
      case 'Battery':
        return 'simple:Battery';
      case 'IntegratedCircuit':
        return 'simple:IC';
      default:
        return 'simple:Generic';
    }
  };
  
  // Helper function to calculate component orientation from connected pad/via positions
  // Uses the relative positions of connected pins to determine rotation
  const calculateComponentRotation = (comp: PCBComponent, nodes: Map<number, NetlistNode>): number => {
    // Default to 0° if no connected pins
    if (!comp.pinConnections || comp.pinConnections.length === 0) {
      return 0;
    }
    
    // Find connected pad/via positions for this component
    const connectedPinPositions: Array<{ pinIndex: number; x: number; y: number }> = [];
    
    for (let pinIndex = 0; pinIndex < comp.pinConnections.length; pinIndex++) {
      const nodeIdStr = comp.pinConnections[pinIndex];
      if (nodeIdStr && nodeIdStr.trim() !== '') {
        const nodeId = parseInt(nodeIdStr.trim(), 10);
        if (!isNaN(nodeId) && nodes.has(nodeId)) {
          const node = nodes.get(nodeId)!;
          // Only use vias and pads (not trace points or power/ground)
          if (node.type === 'via' || node.type === 'pad') {
            connectedPinPositions.push({
              pinIndex,
              x: node.x,
              y: node.y
            });
          }
        }
      }
    }
    
    // Need at least 2 connected pins to determine orientation reliably
    if (connectedPinPositions.length < 2) {
      return 0; // Default to 0° if insufficient data
    }
    
    // For 2-pin components (resistors, capacitors), determine orientation from pin positions
    if (comp.pinCount === 2 && connectedPinPositions.length >= 2) {
      const pin1 = connectedPinPositions.find(p => p.pinIndex === 0);
      const pin2 = connectedPinPositions.find(p => p.pinIndex === 1);
      
      if (pin1 && pin2) {
        // Calculate relative position from component center to pin 1
        const dx = pin1.x - comp.x;
        const dy = pin1.y - comp.y;
        
        // For 2-pin components, pin 1 should be on the left (0°) or top (90°)
        // Normalize angle to 0, 90, 180, or 270
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal orientation
          return dx < 0 ? 0 : 180; // Pin 1 on left = 0°, on right = 180°
        } else {
          // Vertical orientation
          return dy < 0 ? 90 : 270; // Pin 1 on top = 90°, on bottom = 270°
        }
      }
    }
    
    // For multi-pin components (ICs), use pin #1 position relative to component center
    // Pin #1 is typically at top-left when rotation = 0°
    const pin1 = connectedPinPositions.find(p => p.pinIndex === 0);
    if (pin1) {
      const dx = pin1.x - comp.x;
      const dy = pin1.y - comp.y;
      
      // Determine which quadrant pin #1 is in relative to component center
      // For IC at 0°: pin #1 is top-left (dx < 0, dy < 0)
      // For IC at 90°: pin #1 is top-right (dx > 0, dy < 0)
      // For IC at 180°: pin #1 is bottom-right (dx > 0, dy > 0)
      // For IC at 270°: pin #1 is bottom-left (dx < 0, dy > 0)
      
      // Use the dominant direction (larger absolute value)
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal dominant
        if (dx < 0) {
          // Pin #1 is to the left
          // Check if it's top-left (0°) or bottom-left (270°)
          return dy < 0 ? 0 : 270;
        } else {
          // Pin #1 is to the right
          // Check if it's top-right (90°) or bottom-right (180°)
          return dy < 0 ? 90 : 180;
        }
      } else {
        // Vertical dominant
        if (dy < 0) {
          // Pin #1 is above
          // Check if it's top-left (0°) or top-right (90°)
          return dx < 0 ? 0 : 90;
        } else {
          // Pin #1 is below
          // Check if it's bottom-left (270°) or bottom-right (180°)
          return dx < 0 ? 270 : 180;
        }
      }
    }
    
    return 0; // Default to 0° if calculation fails
  };
  
  for (const [designator, info] of componentMap) {
    const uuid = generateUuid();
    const comp = info.comp;
    const symbolLibId = getSymbolLibId(comp.componentType);
    
    // Note: Polarity information could be used for future symbol variants (e.g., polarized capacitor symbol)
    // Components with polarity: Electrolytic Capacitor, Diode, Battery, ZenerDiode
    // Tantalum capacitors also have polarity
    
    // Calculate rotation from connected pad/via positions to preserve PCB layout
    // If component has explicit rotation property, use it; otherwise calculate from pad positions
    let rotation = (comp as any).rotation !== undefined 
      ? (comp as any).rotation 
      : calculateComponentRotation(comp, nodes);
    
    // Normalize rotation to 0, 90, 180, or 270 degrees
    rotation = Math.round(rotation / 90) * 90;
    if (rotation < 0) rotation += 360;
    if (rotation >= 360) rotation -= 360;
    
    // Reference the library symbol - pins are already defined there
    schematic += `  (symbol (lib_id "${symbolLibId}") (at ${info.x} ${info.y} ${rotation}) (unit 1)\n`;
    schematic += `    (in_bom yes) (on_board yes) (dnp no)\n`;
    schematic += `    (uuid ${uuid})\n`;
    schematic += `    (property "Reference" "${designator}" (id 0) (at ${info.x} ${info.y + 3.81} 0)\n`;
    schematic += '      (effects (font (size 1.27 1.27)))\n';
    schematic += '    )\n';
    schematic += `    (property "Value" "${getComponentValueForSchematic(comp)}" (id 1) (at ${info.x} ${info.y - 3.81} 0)\n`;
    schematic += '      (effects (font (size 1.27 1.27)))\n';
    schematic += '    )\n';
    // Pins are defined in the library symbol - no need to add them here
    
    schematic += '  )\n';
  }

  // Add wires and labels to connect components
  schematic += '\n';
  
  // Place power and ground symbols
  let powerGroundX = 25.4;
  let powerGroundY = 25.4;
  const powerGroundSpacing = 25.4;
  const powerGroundSymbols = new Map<string, { x: number; y: number; uuid: string }>();
  
  // For each net, connect all component pins with wires and labels
  console.log(`[Schematic] Processing ${nets.length} nets for wire generation`);
  for (const net of nets) {
    // Handle power nets - add power symbol
    if (net.hasPower && net.powerVoltage) {
      const powerKey = `PWR_${net.powerVoltage}`;
      if (!powerGroundSymbols.has(powerKey)) {
        const powerUuid = generateUuid();
        powerGroundSymbols.set(powerKey, { x: powerGroundX, y: powerGroundY, uuid: powerUuid });
        schematic += `  (symbol (lib_id "simple:Power") (at ${powerGroundX} ${powerGroundY} 0) (unit 1)\n`;
        schematic += `    (in_bom no) (on_board no) (dnp no)\n`;
        schematic += `    (uuid ${powerUuid})\n`;
        schematic += `    (property "Reference" "#PWR" (id 0) (at ${powerGroundX} ${powerGroundY} 0)\n`;
        schematic += '      (effects (font (size 1.27 1.27)) hide)\n';
        schematic += '    )\n';
        schematic += `    (property "Value" "${net.powerVoltage}" (id 1) (at ${powerGroundX} ${powerGroundY - 5.08} 0)\n`;
        schematic += '      (effects (font (size 1.27 1.27)))\n';
        schematic += '    )\n';
        schematic += '  )\n';
        powerGroundX += powerGroundSpacing;
      }
    }
    
    // Handle ground nets - add ground symbol
    if (net.hasGround) {
      const groundKey = 'GND';
      if (!powerGroundSymbols.has(groundKey)) {
        const groundUuid = generateUuid();
        powerGroundSymbols.set(groundKey, { x: powerGroundX, y: powerGroundY, uuid: groundUuid });
        schematic += `  (symbol (lib_id "simple:Ground") (at ${powerGroundX} ${powerGroundY} 0) (unit 1)\n`;
        schematic += `    (in_bom no) (on_board no) (dnp no)\n`;
        schematic += `    (uuid ${groundUuid})\n`;
        schematic += `    (property "Reference" "#PWR" (id 0) (at ${powerGroundX} ${powerGroundY} 0)\n`;
        schematic += '      (effects (font (size 1.27 1.27)) hide)\n';
        schematic += '    )\n';
        schematic += `    (property "Value" "GND" (id 1) (at ${powerGroundX} ${powerGroundY + 5.08} 0)\n`;
        schematic += '      (effects (font (size 1.27 1.27)))\n';
        schematic += '    )\n';
        schematic += '  )\n';
        powerGroundX += powerGroundSpacing;
      }
    }
    
    // Skip nets with no component pins (pure power/ground/via nets will be handled separately)
    if (net.componentPins.length === 0) {
      continue;
    }
    
    // Debug: Log net information
    console.log(`[Schematic] Processing net ${net.name} with ${net.componentPins.length} component pins:`, net.componentPins);
    
    // Sort pins by designator for consistent layout
    const sortedPins = [...net.componentPins].sort((a, b) => {
      const cmp = a.designator.localeCompare(b.designator);
      return cmp !== 0 ? cmp : a.pin - b.pin;
    });
    
    // Get component positions and calculate actual pin positions based on component type and pin count
    const pinPositions: Array<{ x: number; y: number; designator: string; pin: number }> = [];
    for (const pinInfo of sortedPins) {
      const compInfo = componentMap.get(pinInfo.designator);
      if (!compInfo) {
        console.warn(`[Schematic] Component ${pinInfo.designator} not found in componentMap for net ${net.name}`);
        continue;
      }
      
      const comp = compInfo.comp;
      const pinCount = comp.pinCount || 2;
      const PIN_SPACING = 2.54; // Standard pin spacing (0.1 inch)
      
      let pinX: number;
      let pinY: number;
      
      // For 2-pin components (resistors, capacitors, diodes, etc.), use left/right layout
      // Pin positions must match the actual pin positions in the symbol definitions
      if (pinCount === 2) {
        const symbolLibId = getSymbolLibId(comp.componentType);
        if (symbolLibId === 'simple:Resistor') {
          // Resistor pins: Pin 1 at (-6.35, 0), Pin 2 at (6.35, 0) relative to symbol center
          if (pinInfo.pin === 1) {
            pinX = compInfo.x - 6.35; // Left pin position (pin start)
            pinY = compInfo.y;
          } else {
            pinX = compInfo.x + 6.35; // Right pin position (pin start)
            pinY = compInfo.y;
          }
        } else if (symbolLibId === 'simple:Capacitor') {
          // Capacitor pins: Pin 1 at (-5.08, 0), Pin 2 at (5.08, 0) relative to symbol center
          if (pinInfo.pin === 1) {
            pinX = compInfo.x - 5.08; // Left pin position (pin start)
            pinY = compInfo.y;
          } else {
            pinX = compInfo.x + 5.08; // Right pin position (pin start)
            pinY = compInfo.y;
          }
        } else if (symbolLibId === 'simple:Diode' || symbolLibId === 'simple:Switch' || 
                   symbolLibId === 'simple:Inductor' || symbolLibId === 'simple:Battery') {
          // Diode, Switch, Inductor, Battery: Pin 1 at (-5.08, 0), Pin 2 at (5.08, 0)
          if (pinInfo.pin === 1) {
            pinX = compInfo.x - 5.08; // Left pin position (pin start)
            pinY = compInfo.y;
          } else {
            pinX = compInfo.x + 5.08; // Right pin position (pin start)
            pinY = compInfo.y;
          }
        } else {
          // Generic 2-pin: use standard positions
          if (pinInfo.pin === 1) {
            pinX = compInfo.x - 5.08; // Left pin
            pinY = compInfo.y;
          } else {
            pinX = compInfo.x + 5.08; // Right pin
            pinY = compInfo.y;
          }
        }
      } else if (pinCount === 3 && getSymbolLibId(comp.componentType) === 'simple:Transistor') {
        // Transistor: Pin 1 (emitter/base) at top (0, -5.08), Pin 2 (base) at left (-3.81, 0), Pin 3 (collector) at right (3.81, 0)
        if (pinInfo.pin === 1) {
          pinX = compInfo.x;
          pinY = compInfo.y - 5.08; // Top pin
        } else if (pinInfo.pin === 2) {
          pinX = compInfo.x - 3.81; // Left pin
          pinY = compInfo.y;
        } else {
          pinX = compInfo.x + 3.81; // Right pin
          pinY = compInfo.y;
        }
      } else {
        // For multi-pin components (ICs, etc.), use left/right side layout
        // The symbol definition has pins 1-10 on left, 11-20 on right
        // For a component with N pins, we distribute: left side gets ceil(N/2), right side gets floor(N/2)
        const pinsPerLeftSide = Math.ceil(pinCount / 2);
        const pinsPerRightSide = Math.floor(pinCount / 2);
        const isLeftSide = pinInfo.pin <= pinsPerLeftSide;
        
        if (isLeftSide) {
          // Left side pins: positioned at x = -5.08 (relative to component center)
          // Pin position is at the pin start (where wire connects), not at pin end
          pinX = compInfo.x - 5.08; // Pin start position
          const pinIndex = pinInfo.pin - 1; // 0-based index for left side
          // Center the pins vertically: start from -(pinsPerLeftSide-1)*PIN_SPACING/2
          pinY = compInfo.y - ((pinsPerLeftSide - 1) * PIN_SPACING / 2) + (pinIndex * PIN_SPACING);
        } else {
          // Right side pins: positioned at x = 5.08 (relative to component center)
          // Pin position is at the pin start (where wire connects), not at pin end
          pinX = compInfo.x + 5.08; // Pin start position
          // Right side pins start after left side: pinInfo.pin - pinsPerLeftSide gives 1-based index on right
          const pinIndex = pinInfo.pin - pinsPerLeftSide - 1; // Convert to 0-based index for right side
          // Center the pins vertically: start from -(pinsPerRightSide-1)*PIN_SPACING/2
          pinY = compInfo.y - ((pinsPerRightSide - 1) * PIN_SPACING / 2) + (pinIndex * PIN_SPACING);
        }
      }
      
      pinPositions.push({ x: pinX, y: pinY, designator: pinInfo.designator, pin: pinInfo.pin });
    }
    
    // Create connections: connect all pins to a central point with wires and labels
    // Handle both multi-pin nets and single-pin nets (for power/ground connections)
    if (pinPositions.length >= 1) {
      // Calculate center point for this net
      const centerX = pinPositions.length > 1 
        ? pinPositions.reduce((sum, p) => sum + p.x, 0) / pinPositions.length
        : pinPositions[0].x + 10; // Offset single pins to the right
      const centerY = pinPositions.length > 1
        ? pinPositions.reduce((sum, p) => sum + p.y, 0) / pinPositions.length
        : pinPositions[0].y;
      
      // Connect to power symbol if this is a power net
      if (net.hasPower && net.powerVoltage) {
        const powerKey = `PWR_${net.powerVoltage}`;
        const powerSymbol = powerGroundSymbols.get(powerKey);
        if (powerSymbol) {
          // Connect center to power symbol
          const powerConnectionY = powerSymbol.y - 2.54; // Power symbol connection point
          const powerConnectionX = powerSymbol.x;
          
          // Create junction at power connection point
          const powerJunctionUuid = generateUuid();
          schematic += `  (junction (at ${powerConnectionX} ${powerConnectionY}) (diameter 0) (color 0 0 0 0) (uuid ${powerJunctionUuid}))\n`;
          
          // Connect center to power symbol
          const powerWireUuid = generateUuid();
          schematic += `  (wire (pts (xy ${centerX} ${centerY}) (xy ${powerConnectionX} ${powerConnectionY})) (stroke (width 0) (type default)) (uuid ${powerWireUuid}))\n`;
        }
      }
      
      // Connect to ground symbol if this is a ground net
      if (net.hasGround) {
        const groundKey = 'GND';
        const groundSymbol = powerGroundSymbols.get(groundKey);
        if (groundSymbol) {
          // Connect center to ground symbol
          const groundConnectionY = groundSymbol.y + 2.54; // Ground symbol connection point
          const groundConnectionX = groundSymbol.x;
          
          // Create junction at ground connection point
          const groundJunctionUuid = generateUuid();
          schematic += `  (junction (at ${groundConnectionX} ${groundConnectionY}) (diameter 0) (color 0 0 0 0) (uuid ${groundJunctionUuid}))\n`;
          
          // Connect center to ground symbol
          const groundWireUuid = generateUuid();
          schematic += `  (wire (pts (xy ${centerX} ${centerY}) (xy ${groundConnectionX} ${groundConnectionY})) (stroke (width 0) (type default)) (uuid ${groundWireUuid}))\n`;
        }
      }
      
      // For multi-pin nets, create connections between all pins
      // Use a "bus" style: connect pins in a chain with a central junction for clarity
      if (pinPositions.length >= 2) {
        console.log(`[Schematic] Creating wires for net ${net.name}: ${pinPositions.length} pins`);
        
        // For 2 pins: direct connection
        if (pinPositions.length === 2) {
          const wireUuid = generateUuid();
          schematic += `  (wire (pts (xy ${pinPositions[0].x} ${pinPositions[0].y}) (xy ${pinPositions[1].x} ${pinPositions[1].y})) (stroke (width 0) (type default)) (uuid ${wireUuid}))\n`;
        } else {
          // For 3+ pins: use a bus-style connection with a central junction
          // Create a central junction point
          const centerUuid = generateUuid();
          schematic += `  (junction (at ${centerX} ${centerY}) (diameter 0.508) (color 0 0 0 0) (uuid ${centerUuid}))\n`;
          
          // Connect each pin to the center junction with wires
          for (const pinPos of pinPositions) {
            const wireUuid = generateUuid();
            console.log(`[Schematic] Wire from ${pinPos.designator}:pin${pinPos.pin} (${pinPos.x}, ${pinPos.y}) to center (${centerX}, ${centerY})`);
            schematic += `  (wire (pts (xy ${pinPos.x} ${pinPos.y}) (xy ${centerX} ${centerY})) (stroke (width 0) (type default)) (uuid ${wireUuid}))\n`;
          }
        }
      } else if (pinPositions.length === 1) {
        // Single pin: create a junction at the pin position (for power/ground connections)
        console.log(`[Schematic] Creating junction for single-pin net ${net.name} at (${pinPositions[0].x}, ${pinPositions[0].y})`);
        const pinJunctionUuid = generateUuid();
        schematic += `  (junction (at ${pinPositions[0].x} ${pinPositions[0].y}) (diameter 0.508) (color 0 0 0 0) (uuid ${pinJunctionUuid}))\n`;
      } else {
        console.warn(`[Schematic] Net ${net.name} has ${net.componentPins.length} component pins but 0 valid pin positions!`);
      }
      
      // Add a text label to identify the net
      const labelY = pinPositions.length > 1 ? centerY + 5.08 : pinPositions[0].y + 5.08;
      const labelX = pinPositions.length > 1 ? centerX : pinPositions[0].x;
      const textUuid = generateUuid();
      const netLabel = net.hasPower && net.powerVoltage 
        ? net.powerVoltage 
        : net.hasGround 
        ? 'GND' 
        : net.name;
      schematic += `  (text "${netLabel}" (at ${labelX} ${labelY} 0)\n`;
      schematic += `    (effects (font (size 1.27 1.27)))\n`;
      schematic += `    (uuid ${textUuid})\n`;
      schematic += '  )\n';
    }
  }

  schematic += ')\n';
  
  return schematic;
}

