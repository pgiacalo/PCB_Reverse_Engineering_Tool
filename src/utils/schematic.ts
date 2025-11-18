// ============================================================================
// Simple Schematic Generator
// ============================================================================
// Generates a simple KiCad schematic from netlist data
// Focuses on showing connections, not conforming to KiCad conventions

import type { PCBComponent, DrawingStroke, GroundSymbol } from '../types';
import { 
  buildConnectivityGraphCoordinateBased, 
  groupNodesIntoNetsCoordinateBased, 
  generateNetNamesCoordinateBased, 
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
  // Build connectivity using coordinate-based matching
  const coordinateToNode = buildConnectivityGraphCoordinateBased(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses
  );

  // Debug: Check component pin nodes
  const componentPinNodes = Array.from(coordinateToNode.values()).filter(n => n.type === 'component_pin');
  console.log(`[Schematic] Component pin nodes in graph: ${componentPinNodes.length}`);
  if (componentPinNodes.length > 0) {
    console.log(`[Schematic] Sample component pin nodes:`, componentPinNodes.slice(0, 5).map(n =>
      `coord(${n.x},${n.y}) (compId: ${n.componentId}, pinIndex: ${n.pinIndex})`
    ));
  }

  // Build connections from traces (coordinate-based)
  const connections: Array<[string, string]> = [];

  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        if (point1 && point2) {
          const coordKey1 = `${Math.round(point1.x)},${Math.round(point1.y)}`;
          const coordKey2 = `${Math.round(point2.x)},${Math.round(point2.y)}`;
          if (coordKey1 !== coordKey2) {
            connections.push([coordKey1, coordKey2]);
          }
        }
      }
    }
  }

  console.log(`[Schematic] Trace connections: ${connections.length}`);

  // Note: Points with the same x,y coordinates are already the same node in coordinateToNode.
  // The union-find algorithm will group connected nodes together.

  const netGroups = groupNodesIntoNetsCoordinateBased(coordinateToNode, connections);
  const netNames = generateNetNamesCoordinateBased(netGroups, coordinateToNode);
  
  console.log(`[Schematic] Net groups created: ${netGroups.size}`);
  
  // Check which component pins are in nets vs isolated (after netGroups is created)
  if (componentPinNodes.length > 0) {
    const isolatedPins: Array<{ compId: string; designator: string; pinIndex: number; x: number; y: number; coordKey: string }> = [];
    
    for (const node of componentPinNodes) {
      const coordKey = `${node.x},${node.y}`;
      // Check if this coordinate appears in any net group
      let foundInNet = false;
      for (const [, netNodes] of netGroups) {
        if (netNodes.some(n => n.x === node.x && n.y === node.y)) {
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
          x: node.x,
          y: node.y,
          coordKey
        });
      }
    }
    
    if (isolatedPins.length > 0) {
      console.warn(`[Schematic] Found ${isolatedPins.length} isolated component pins (not in any net):`);
      for (const pin of isolatedPins.slice(0, 10)) { // Show first 10
        console.warn(`  - ${pin.designator} pin ${pin.pinIndex + 1} at coord(${pin.x},${pin.y})`);
      }
    } else {
      console.log(`[Schematic] All component pins are in nets`);
    }
  }
  
  // Build component ID to designator map (used for both nets and component layout)
  const componentIdToDesignator = new Map<string, string>();
  for (const comp of components) {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (designator) {
      componentIdToDesignator.set(comp.id, designator);
    }
  }

  // Build nets with component pin connections
  const nets: Net[] = [];
  let totalNetGroups = 0;
  let totalComponentPinsFound = 0;
  const componentPinNodesByNet = new Map<string, NetlistNode[]>();
  
  // First pass: collect all component pin nodes by their net root
  for (const [rootCoordKey, netNodes] of netGroups) {
    totalNetGroups++;
    const componentPinsInNet: NetlistNode[] = [];

    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        componentPinsInNet.push(node);
        totalComponentPinsFound++;
      }
    }

    if (componentPinsInNet.length > 0) {
      componentPinNodesByNet.set(rootCoordKey, componentPinsInNet);
    }
  }

  // Second pass: build nets from component pins
  for (const [rootCoordKey, componentPinNodes] of componentPinNodesByNet) {
    const netName = netNames.get(rootCoordKey) || `N$${rootCoordKey}`;
    const componentPins: Array<{ designator: string; pin: number }> = [];
    
    for (const node of componentPinNodes) {
      const designator = componentIdToDesignator.get(node.componentId!);
      if (designator) {
        componentPins.push({ designator, pin: (node.pinIndex || 0) + 1 });
      } else {
        console.warn(`[Schematic] Component pin found but no designator for componentId: ${node.componentId}`);
      }
    }
    
    // Only include nets with at least 2 component pins (need at least 2 to connect)
    if (componentPins.length >= 2) {
      nets.push({ name: netName, componentPins });
    } else if (componentPins.length === 1) {
      console.log(`[Schematic] Net ${netName} has only 1 component pin: ${componentPins[0].designator} pin ${componentPins[0].pin}`);
    }
  }
  
  // Debug: log net information
  console.log(`[Schematic] Total net groups: ${totalNetGroups}, Component pins found: ${totalComponentPinsFound}`);
  console.log(`[Schematic] Nets with component pins: ${componentPinNodesByNet.size}`);
  console.log(`[Schematic] Generated ${nets.length} nets with 2+ component connections`);
  
  // Show details of nets with component pins
  if (componentPinNodesByNet.size > 0) {
    console.log(`[Schematic] Sample nets with component pins:`);
    let count = 0;
    for (const [rootCoordKey, componentPinNodes] of componentPinNodesByNet) {
      if (count++ >= 5) break; // Show first 5
      const netName = netNames.get(rootCoordKey) || `N$${rootCoordKey}`;
      const pinDetails = componentPinNodes.map(n => {
        const designator = componentIdToDesignator.get(n.componentId!);
        return `${designator || 'unknown'}:pin${(n.pinIndex || 0) + 1}@coord(${n.x},${n.y})`;
      });
      console.log(`  Net ${netName} (root ${rootCoordKey}): ${componentPinNodes.length} pins - ${pinDetails.join(', ')}`);
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
  // Include all components that have designators (either abbreviation or designator field)
  const componentsWithDesignators = components.filter(c => {
    const d = (c as any).abbreviation?.trim() || c.designator?.trim();
    return !!d; // Just check if designator exists, don't require it to be in componentIdToDesignator
  });

  const GRID_SPACING = 50.8; // 2 inches in mm
  const COMPONENTS_PER_ROW = Math.ceil(Math.sqrt(componentsWithDesignators.length));
  
  let x = 25.4; // Start at 1 inch
  let y = 25.4;
  let col = 0;

  for (const comp of componentsWithDesignators) {
    const designator = (comp as any).abbreviation?.trim() || comp.designator?.trim();
    if (designator) {
      componentMap.set(designator, { comp, designator, x, y });
      
      col++;
      if (col >= COMPONENTS_PER_ROW) {
        col = 0;
        x = 25.4;
        y += GRID_SPACING;
      } else {
        x += GRID_SPACING;
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

  for (const [designator, info] of componentMap) {
    const uuid = generateUuid();
    const comp = info.comp;
    // const pinCount = comp.pinCount; // Reserved for future use
    
    // Reference the library symbol - pins are already defined there
    schematic += `  (symbol (lib_id "simple:Generic") (at ${info.x} ${info.y} 0) (unit 1)\n`;
    schematic += `    (in_bom yes) (on_board yes) (dnp no)\n`;
    schematic += `    (uuid ${uuid})\n`;
    schematic += `    (property "Reference" "${designator}" (id 0) (at ${info.x} ${info.y + 3.81} 0)\n`;
    schematic += '      (effects (font (size 1.27 1.27)))\n';
    schematic += '    )\n';
    schematic += `    (property "Value" "${comp.componentType}" (id 1) (at ${info.x} ${info.y - 3.81} 0)\n`;
    schematic += '      (effects (font (size 1.27 1.27)))\n';
    schematic += '    )\n';
    // Pins are defined in the library symbol - no need to add them here
    
    schematic += '  )\n';
  }

  // Add wires and labels to connect components
  schematic += '\n';
  
  // For each net, connect all component pins with wires and labels
  console.log(`[Schematic] Processing ${nets.length} nets for wire generation`);
  for (const net of nets) {
    // All nets should already have >= 2 pins from filtering above, but double-check
    if (net.componentPins.length < 2) {
      console.warn(`[Schematic] Skipping net ${net.name} with only ${net.componentPins.length} pins`);
      continue;
    }
    
    // Sort pins by designator for consistent layout
    const sortedPins = [...net.componentPins].sort((a, b) => {
      const cmp = a.designator.localeCompare(b.designator);
      return cmp !== 0 ? cmp : a.pin - b.pin;
    });
    
    // Get component positions
    // Note: Library symbol has pins 1-10 on left, 11-20 on right
    const pinPositions: Array<{ x: number; y: number; designator: string; pin: number }> = [];
    for (const pinInfo of sortedPins) {
      const compInfo = componentMap.get(pinInfo.designator);
      if (!compInfo) continue;
      
      const PIN_SPACING = 2.54;
      // const WIDTH = 10.16; // Fixed width for library symbol - reserved for future use
      const isLeftSide = pinInfo.pin <= 10;
      
      let pinX: number;
      let pinY: number;
      
      if (isLeftSide) {
        // Left side pins 1-10: positioned at x = -5.08 (relative to component center)
        pinX = compInfo.x - 5.08 - 2.54; // Pin extends 2.54mm left from symbol edge
        pinY = compInfo.y - ((10 - 1) * PIN_SPACING / 2) + ((pinInfo.pin - 1) * PIN_SPACING);
      } else {
        // Right side pins 11-20: positioned at x = 5.08 (relative to component center)
        pinX = compInfo.x + 5.08 + 2.54; // Pin extends 2.54mm right from symbol edge
        pinY = compInfo.y - ((10 - 1) * PIN_SPACING / 2) + ((pinInfo.pin - 11) * PIN_SPACING);
      }
      
      pinPositions.push({ x: pinX, y: pinY, designator: pinInfo.designator, pin: pinInfo.pin });
    }
    
    // Create a bus-like connection: connect all pins to a central point with wires and labels
    if (pinPositions.length >= 2) {
      // Calculate center point for this net
      const centerX = pinPositions.reduce((sum, p) => sum + p.x, 0) / pinPositions.length;
      const centerY = pinPositions.reduce((sum, p) => sum + p.y, 0) / pinPositions.length;
      
      // Connect all pins with wires in a star pattern (all to center point)
      // First, create a central junction point
      const centerUuid = generateUuid();
      schematic += `  (junction (at ${centerX} ${centerY}) (diameter 0) (color 0 0 0 0) (uuid ${centerUuid}))\n`;
      
      // Connect each pin to the center junction with wires
      for (const pinPos of pinPositions) {
        const wireUuid = generateUuid();
        schematic += `  (wire (pts (xy ${pinPos.x} ${pinPos.y}) (xy ${centerX} ${centerY})) (stroke (width 0) (type default)) (uuid ${wireUuid}))\n`;
      }
      
      // Add a text label near the center to identify the net (using text element, not label)
      const textUuid = generateUuid();
      schematic += `  (text "${net.name}" (at ${centerX} ${centerY + 5.08} 0)\n`;
      schematic += `    (effects (font (size 1.27 1.27)))\n`;
      schematic += `    (uuid ${textUuid})\n`;
      schematic += '  )\n';
    }
  }

  schematic += ')\n';
  
  return schematic;
}

