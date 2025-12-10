/**
 * Copyright (c) 2025 Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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

/**
 * Normalize voltage string for consistent comparison (KiCad standard notation)
 * Handles variations like "+3.3V", "3.3V", "+3.3 VDC", etc.
 * Returns normalized format: sign + numeric value + "V" (KiCad convention: +5V, -3V3, etc.)
 * For decimals, KiCad uses format like -3V3 instead of -3.3V
 * Ground is always "GND" (not normalized here)
 */
function normalizeVoltage(voltage: string): string {
  if (!voltage) return 'UNKNOWN';
  
  // Trim whitespace
  let normalized = voltage.trim();
  
  // Remove common suffixes like "VDC", "VAC", "DC", "AC", or standalone "V" (case insensitive)
  // Handle these in order: VDC/VAC first, then DC/AC, then standalone V
  normalized = normalized.replace(/\s*(VDC|VAC)\s*$/i, '');
  normalized = normalized.replace(/\s*(DC|AC)\s*$/i, '');
  normalized = normalized.replace(/\s*V\s*$/i, '');
  
  // Extract sign (+ or -) and numeric value
  const signMatch = normalized.match(/^([+-])?/);
  const sign = signMatch ? signMatch[1] || '+' : '+';
  
  // Extract numeric part (allows decimals)
  const numMatch = normalized.match(/(\d+\.?\d*)/);
  if (!numMatch) {
    // If no numeric value found, return original (trimmed) for fallback
    return voltage.trim();
  }
  
  let numValue = numMatch[1];
  
  // KiCad convention: for decimals, use format like "3V3" instead of "3.3V"
  // Example: 3.3 becomes 3V3, 5.0 becomes 5V0, 12.5 becomes 12V5
  if (numValue.includes('.')) {
    const parts = numValue.split('.');
    const wholePart = parts[0];
    const decimalPart = parts[1] || '0';
    // Remove trailing zeros from decimal part
    const cleanDecimal = decimalPart.replace(/0+$/, '') || '0';
    numValue = `${wholePart}V${cleanDecimal}`;
  }
  
  // Return normalized format: sign + numeric value + "V" (KiCad convention)
  // This ensures "+3.3V", "3.3V", "+3.3 VDC" all become "+3V3" (or "+5V" for whole numbers)
  return `${sign}${numValue}V`;
}

/**
 * Format voltage string to KiCad standard notation (+5V, -3V3, etc.)
 * Uses normalizeVoltage but ensures proper formatting
 */
function formatVoltageKiCad(voltage: string): string {
  return normalizeVoltage(voltage);
}

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
 * Helper to read value and unit from component
 */
function readValueAndUnit(
  component: any,
  valueField: string,
  unitField: string,
  defaultUnit: string
): { value: string; unit: string } {
  // Special case: power is always stored as combined value+unit (e.g., "1/4W", "1W")
  if (valueField === 'power') {
    const powerValue = component[valueField] || '';
    if (typeof powerValue === 'string' && powerValue.trim() !== '') {
      // Remove trailing "W" if present
      const value = powerValue.replace(/W$/i, '').trim();
      return { value, unit: 'W' };
    }
    return { value: '', unit: 'W' };
  }
  
  // Try to read separate fields first (new format)
  if (component[valueField] !== undefined || component[unitField] !== undefined) {
    return {
      value: component[valueField] || '',
      unit: component[unitField] || defaultUnit,
    };
  }
  
  // Fallback: parse combined string if no separate fields
  const combined = component[valueField] || '';
  if (typeof combined === 'string' && combined.trim() !== '') {
    // Try to match fractional values (e.g., "1/4W", "1/2W") or number followed by unit
    const fractionalMatch = combined.trim().match(/^([\d]+\/[\d]+)\s*([a-zA-ZΩµμuW]+)?$/);
    if (fractionalMatch) {
      return { value: fractionalMatch[1], unit: fractionalMatch[2] || '' };
    }
    
    // Try to match number followed by unit (handles k, M, m, µ, u, etc.)
    const match = combined.trim().match(/^([\d.]+)\s*([a-zA-ZΩµμuW]+)?$/);
    if (match) {
      return { value: match[1], unit: match[2] || '' };
    }
    
    // If no match, return as-is
    return { value: combined.trim(), unit: '' };
  }
  
  return { value: '', unit: defaultUnit };
}

/**
 * Helper to combine value and unit into a single string
 */
function combineValueAndUnit(value: string, unit: string): string {
  if (!value || value.trim() === '') return '';
  if (!unit || unit.trim() === '') return value.trim();
  return `${value.trim()}${unit.trim()}`;
}

/**
 * Get default unit for a property
 */
function getDefaultUnit(property: string): string {
  const unitMap: Record<string, string> = {
    resistance: 'Ω',
    capacitance: 'F',
    inductance: 'H',
    voltage: 'V',
    current: 'A',
    power: 'W',
    impedance: 'Ω',
    capacity: 'mAh',
    esr: 'Ω',
    coilVoltage: 'V',
    inputVoltage: 'V',
    outputVoltage: 'V',
  };
  return unitMap[property] || '';
}

/**
 * Get component value for schematic generation with proper units
 * Prioritizes actual component values (resistance, capacitance, etc.) with units
 * For passive components: uses resistance/capacitance/inductance with units
 * For active components: uses partNumber or partName
 * Falls back to componentType if no specific value is available
 */
function getComponentValueForSchematic(comp: PCBComponent): string {
  // For Resistor: use resistance with unit
  if (comp.componentType === 'Resistor' && 'resistance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'resistance', 'resistanceUnit', getDefaultUnit('resistance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Capacitor: use capacitance with unit
  if (comp.componentType === 'Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Electrolytic Capacitor: use capacitance with unit
  if (comp.componentType === 'Electrolytic Capacitor' && 'capacitance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'capacitance', 'capacitanceUnit', getDefaultUnit('capacitance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
    }
  }
  
  // For Inductor: use inductance with unit
  if (comp.componentType === 'Inductor' && 'inductance' in comp) {
    const { value, unit } = readValueAndUnit(comp, 'inductance', 'inductanceUnit', getDefaultUnit('inductance'));
    if (value && value.trim() !== '') {
      return combineValueAndUnit(value, unit);
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
 * Traverse all traces connected to a node, collecting connected nodes and components
 * Uses depth-first search to follow all trace paths until reaching nodes or components
 * CRITICAL: Examines each trace's points directly to follow the complete path,
 * including intermediate points without Node IDs, to find all connected nodes
 * 
 * NOTE: This function is currently unused but kept for potential future use
 */
export function traverseNodeConnections(
  startNodeId: number,
  nodes: Map<number, NetlistNode>,
  drawingStrokes: DrawingStroke[],
  componentIdToDesignator: Map<string, string>
): {
  connectedNodeIds: number[];
  connectedComponents: string[];
  connectedComponentPins: Array<{ designator: string; pin: number }>;
} {
  // Build adjacency list by examining each trace's points directly
  // This ensures we follow the complete trace path, including intermediate points
  const adjacencyList = new Map<number, Set<number>>();
  
  // Initialize adjacency list for all nodes
  for (const nodeId of nodes.keys()) {
    if (!adjacencyList.has(nodeId)) {
      adjacencyList.set(nodeId, new Set());
    }
  }
  
  // Process each trace to build connections
  // CRITICAL: Follow the trace path point-by-point, connecting all nodes with Node IDs
  // even if they're separated by intermediate points without Node IDs
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      // Extract all points with Node IDs from this trace
      const nodesInTrace: Array<{ pointIndex: number; nodeId: number }> = [];
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        if (point && point.id !== undefined && point.id !== null) {
          nodesInTrace.push({ pointIndex: i, nodeId: point.id });
        }
      }
      
      // Connect all nodes in the trace (they're all connected through the trace path)
      // Even if separated by intermediate points, they're on the same trace
      for (let i = 0; i < nodesInTrace.length; i++) {
        for (let j = i + 1; j < nodesInTrace.length; j++) {
          const nodeId1 = nodesInTrace[i].nodeId;
          const nodeId2 = nodesInTrace[j].nodeId;
          
          // Ensure both nodes exist in the nodes map
          if (nodes.has(nodeId1) && nodes.has(nodeId2)) {
            if (!adjacencyList.has(nodeId1)) {
              adjacencyList.set(nodeId1, new Set());
            }
            if (!adjacencyList.has(nodeId2)) {
              adjacencyList.set(nodeId2, new Set());
            }
            adjacencyList.get(nodeId1)!.add(nodeId2);
            adjacencyList.get(nodeId2)!.add(nodeId1);
          }
        }
      }
      
      // Also connect consecutive points in the trace (for following the path)
      // This handles intermediate points and ensures we can traverse the full path
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        
        // If both points have Node IDs, connect them
        if (point1 && point2 && point1.id !== undefined && point1.id !== null &&
            point2.id !== undefined && point2.id !== null) {
          const nodeId1 = point1.id;
          const nodeId2 = point2.id;
          
          if (nodes.has(nodeId1) && nodes.has(nodeId2)) {
            if (!adjacencyList.has(nodeId1)) {
              adjacencyList.set(nodeId1, new Set());
            }
            if (!adjacencyList.has(nodeId2)) {
              adjacencyList.set(nodeId2, new Set());
            }
            adjacencyList.get(nodeId1)!.add(nodeId2);
            adjacencyList.get(nodeId2)!.add(nodeId1);
          }
        }
      }
    }
  }

  // Perform depth-first search to traverse all connected traces
  const visited = new Set<number>();
  const connectedNodeIds = new Set<number>();
  const connectedComponentPins = new Map<string, Array<{ designator: string; pin: number }>>();

  function dfs(currentNodeId: number) {
    if (visited.has(currentNodeId)) {
      return;
    }
    visited.add(currentNodeId);

    const currentNode = nodes.get(currentNodeId);
    if (!currentNode) {
      return;
    }

    // If we've reached a non-trace-point node (via, pad, ground, power, component_pin)
    // and it's not the starting node, record it as a connected node
    if (currentNodeId !== startNodeId && currentNode.type !== 'trace_point') {
      connectedNodeIds.add(currentNodeId);
    }

    // If we've reached a component pin, record it
    if (currentNode.type === 'component_pin' && currentNode.componentId && currentNode.pinIndex !== undefined) {
      const designator = componentIdToDesignator.get(currentNode.componentId);
      if (designator) {
        const pinKey = `${currentNode.componentId}:${currentNode.pinIndex}`;
        if (!connectedComponentPins.has(pinKey)) {
          connectedComponentPins.set(pinKey, [{
            designator,
            pin: (currentNode.pinIndex || 0) + 1,
          }]);
        }
      }
    }

    // Continue traversing through all connected nodes (following traces)
    const neighbors = adjacencyList.get(currentNodeId);
    if (neighbors) {
      for (const neighborId of neighbors) {
        // Continue traversing even through trace points (they're just connecting wires)
        // Stop only when we reach the end of a trace or hit a non-trace-point node
        dfs(neighborId);
      }
    }
  }

  // Start traversal from the selected node
  dfs(startNodeId);

  // Convert sets to sorted arrays
  const sortedConnectedNodeIds = Array.from(connectedNodeIds).sort((a, b) => a - b);
  
  // Get unique component designators
  const uniqueComponents = new Set<string>();
  const componentPinsList: Array<{ designator: string; pin: number }> = [];
  for (const pins of connectedComponentPins.values()) {
    for (const pin of pins) {
      uniqueComponents.add(pin.designator);
      componentPinsList.push(pin);
    }
  }

  // Sort component pins by designator, then pin number
  componentPinsList.sort((a, b) => {
    if (a.designator !== b.designator) {
      return a.designator.localeCompare(b.designator);
    }
    return a.pin - b.pin;
  });

  return {
    connectedNodeIds: sortedConnectedNodeIds,
    connectedComponents: Array.from(uniqueComponents).sort(),
    connectedComponentPins: componentPinsList,
  };
}

/**
 * Get direct/first-level neighbors of a node (not full traversal)
 * Only returns nodes directly connected via a single trace segment
 */
function getDirectNeighbors(
  nodeId: number,
  nodes: Map<number, NetlistNode>,
  drawingStrokes: DrawingStroke[],
  componentIdToDesignator: Map<string, string>
): {
  directNeighborIds: number[];
  componentPins: Array<{ designator: string; pin: number }>;
} {
  // Build adjacency list for direct connections only
  const adjacencyList = new Map<number, Set<number>>();
  
  // Initialize adjacency list for all nodes
  for (const nodeId of nodes.keys()) {
    if (!adjacencyList.has(nodeId)) {
      adjacencyList.set(nodeId, new Set());
    }
  }
  
  // Process each trace to build direct connections
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      // Connect consecutive points in the trace (direct neighbors only)
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const point1 = stroke.points[i];
        const point2 = stroke.points[i + 1];
        
        // If both points have Node IDs, connect them as direct neighbors
        if (point1 && point2 && point1.id !== undefined && point1.id !== null &&
            point2.id !== undefined && point2.id !== null) {
          const nodeId1 = point1.id;
          const nodeId2 = point2.id;
          
          if (nodes.has(nodeId1) && nodes.has(nodeId2)) {
            if (!adjacencyList.has(nodeId1)) {
              adjacencyList.set(nodeId1, new Set());
            }
            if (!adjacencyList.has(nodeId2)) {
              adjacencyList.set(nodeId2, new Set());
            }
            adjacencyList.get(nodeId1)!.add(nodeId2);
            adjacencyList.get(nodeId2)!.add(nodeId1);
          }
        }
      }
    }
  }

  // Get direct neighbors only (first-level connections)
  const directNeighborIds = new Set<number>();
  const neighbors = adjacencyList.get(nodeId);
  if (neighbors) {
    for (const neighborId of neighbors) {
      const neighborNode = nodes.get(neighborId);
      // Only include non-trace-point nodes as neighbors
      if (neighborNode && neighborNode.type !== 'trace_point') {
        directNeighborIds.add(neighborId);
      }
    }
  }

  // Find component pins directly connected to this node or its direct neighbors
  const componentPins: Array<{ designator: string; pin: number }> = [];

  // Check if the node itself is a component pin
  const currentNode = nodes.get(nodeId);
  if (currentNode && currentNode.type === 'component_pin' && currentNode.componentId && currentNode.pinIndex !== undefined) {
    const designator = componentIdToDesignator.get(currentNode.componentId);
    if (designator) {
      componentPins.push({
        designator,
        pin: (currentNode.pinIndex || 0) + 1,
      });
    }
  }

  // Check direct neighbors for component pins
  for (const neighborId of directNeighborIds) {
    const neighborNode = nodes.get(neighborId);
    if (neighborNode && neighborNode.type === 'component_pin' && neighborNode.componentId && neighborNode.pinIndex !== undefined) {
      const designator = componentIdToDesignator.get(neighborNode.componentId);
      if (designator) {
        componentPins.push({
          designator,
          pin: (neighborNode.pinIndex || 0) + 1,
        });
      }
    }
  }

  // Sort and deduplicate component pins
  const uniquePins = new Map<string, { designator: string; pin: number }>();
  for (const pin of componentPins) {
    const key = `${pin.designator}:${pin.pin}`;
    if (!uniquePins.has(key)) {
      uniquePins.set(key, pin);
    }
  }
  const sortedPins = Array.from(uniquePins.values()).sort((a, b) => {
    if (a.designator !== b.designator) {
      return a.designator.localeCompare(b.designator);
    }
    return a.pin - b.pin;
  });

  return {
    directNeighborIds: Array.from(directNeighborIds).sort((a, b) => a - b),
    componentPins: sortedPins,
  };
}

/**
 * Check if a node has directly attached components
 * A node qualifies if:
 * 1. The node itself is a component_pin, OR
 * 2. The node has component pins as direct neighbors (first-level connection)
 */
function hasDirectlyAttachedComponents(
  nodeId: number,
  nodes: Map<number, NetlistNode>,
  drawingStrokes: DrawingStroke[],
  componentIdToDesignator: Map<string, string>
): boolean {
  const currentNode = nodes.get(nodeId);
  if (!currentNode) {
    return false;
  }

  // Check if the node itself is a component pin
  if (currentNode.type === 'component_pin') {
    return true;
  }

  // Check if any direct neighbors are component pins
  const { directNeighborIds } = getDirectNeighbors(nodeId, nodes, drawingStrokes, componentIdToDesignator);
  for (const neighborId of directNeighborIds) {
    const neighborNode = nodes.get(neighborId);
    if (neighborNode && neighborNode.type === 'component_pin') {
      return true;
    }
  }

  return false;
}

/**
 * Generate nodes CSV file with filtered connectivity information
 * Only includes nodes with directly attached components
 * Only shows first-level/direct connected nodes (not full traversal)
 * Returns CSV content as string
 */
export function generateNodesCsv(
  nodes: Map<number, NetlistNode>,
  netGroups: Map<number, NetlistNode[]>,
  _netNames: Map<number, string>,
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[]
): string {
  // Build component ID to designator map
  const componentIdToDesignator = new Map<string, string>();
  for (const comp of components) {
    let designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
    if (designator && (designator === '?' || designator === '??' || designator === '***' || designator === '****' || designator === '*')) {
      designator = '';
    }
    if (designator && designator.length > 0) {
      componentIdToDesignator.set(comp.id, designator);
    }
  }

  // Build CSV rows
  const csvRows: string[] = [];
  
  // CSV Header
  csvRows.push('Node ID,Node Type,Connected Node IDs,Connected Components,Connected Component Pins');

  // Iterate through every node (excluding trace points - they are just connecting wires)
  // NEW: Only include nodes that have directly attached components
  for (const [nodeId, node] of nodes) {
    // Skip trace points - they are only connecting wires, not important nodes
    if (node.type === 'trace_point') {
      continue;
    }

    // NEW: Filter - only include nodes with directly attached components
    if (!hasDirectlyAttachedComponents(nodeId, nodes, drawingStrokes, componentIdToDesignator)) {
      continue;
    }

    // Get all nodes in the same net (for determining node type - Ground/Power/Signal)
    // We use netGroups to check if this node is connected to ground/power
    let rootNodeId: number | undefined;
    for (const [rootId, netNodes] of netGroups) {
      if (netNodes.some(n => n.id === nodeId)) {
        rootNodeId = rootId;
        break;
      }
    }
    
    const netNodes = rootNodeId ? netGroups.get(rootNodeId) || [] : [];
    
    // Determine node type label
    // For vias and pads: use Signal, Ground, or Power based on connections
    // For other node types: use their base type
    let nodeType: string;
    
    // Check if this net contains ground or power nodes
    // This traverses through all traces to find if any ground/power nodes are connected
    const hasGround = netNodes.some(n => n.type === 'ground');
    const powerNodes = netNodes.filter(n => n.type === 'power');
    
    if (node.type === 'via' || node.type === 'pad') {
      // Vias and pads are labeled as Signal, Ground, or Power based on connections
      if (hasGround) {
        nodeType = 'Ground';
      } else if (powerNodes.length > 0) {
        // Use the voltage from power nodes, format to KiCad standard notation (+5V, -3V3, etc.)
        const voltage = powerNodes[0].voltage || 'UNKNOWN';
        const cleanVoltage = formatVoltageKiCad(voltage);
        nodeType = `Power ${cleanVoltage}`;
      } else {
        nodeType = 'Signal';
      }
    } else {
      // For other node types, use their base type or check for ground/power
      nodeType = getNodeTypeLabel(node);
      
      if (hasGround) {
        nodeType = 'Ground';
      } else if (powerNodes.length > 0 && node.type === 'component_pin') {
        // Component pins can also be labeled as Power if connected to power
        const voltage = powerNodes[0].voltage || 'UNKNOWN';
        const cleanVoltage = formatVoltageKiCad(voltage);
        nodeType = `Power ${cleanVoltage}`;
      }
    }

    // NEW: Get only direct/first-level neighbors (not full traversal)
    const directNeighbors = getDirectNeighbors(nodeId, nodes, drawingStrokes, componentIdToDesignator);
    const connectedNodeIds = directNeighbors.directNeighborIds;
    const componentPins = directNeighbors.componentPins;

    // Get unique component designators from component pins
    const connectedComponents = Array.from(new Set(componentPins.map(p => p.designator))).sort();

    // Format connected node IDs - all in one column, semicolon-separated
    const connectedNodeIdsStr = connectedNodeIds.length > 0 
      ? connectedNodeIds.join(';') 
      : '';

    // Format connected components - all in one column, semicolon-separated
    const connectedComponentsStr = connectedComponents.length > 0
      ? connectedComponents.join(';')
      : '';

    // Format connected component pins - all in one column, semicolon-separated
    const connectedComponentPinsStr = componentPins.length > 0
      ? componentPins.map(p => `${p.designator}:${p.pin}`).join(';')
      : '';

    // Escape CSV values (handle commas, quotes, newlines, semicolons)
    const escapeCsv = (value: string): string => {
      // If value contains comma, quote, newline, or semicolon, wrap in quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes(';')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Create exactly 5 columns as specified
    csvRows.push([
      nodeId.toString(),
      escapeCsv(nodeType),
      escapeCsv(connectedNodeIdsStr),
      escapeCsv(connectedComponentsStr),
      escapeCsv(connectedComponentPinsStr),
    ].join(','));
  }

  return csvRows.join('\n');
}

/**
 * Get node type label for CSV export
 */
function getNodeTypeLabel(node: NetlistNode): string {
  switch (node.type) {
    case 'via':
      return 'via';
    case 'pad':
      return 'pad';
    case 'trace_point':
      return 'trace_point';
    case 'ground':
      return 'GND';
    case 'power':
      return node.voltage ? `Power ${normalizeVoltage(node.voltage)}` : 'Power';
    case 'component_pin':
      return 'component_pin';
    default:
      return 'unknown';
  }
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
): { schematic: string; nodesCsv: string } {
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
  
  // ============================================================================
  // COMPREHENSIVE NODE TREE ANALYSIS
  // ============================================================================
  // Walk the entire tree of nodes to determine all connections, ground points, and power buses
  console.log(`\n[Schematic Analysis] ========================================`);
  console.log(`[Schematic Analysis] Starting comprehensive node tree analysis`);
  console.log(`[Schematic Analysis] ========================================`);
  
  // Build component ID to designator map for analysis (temporary, will be rebuilt later)
  const analysisComponentIdToDesignator = new Map<string, string>();
  for (const comp of components) {
    let designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
    if (designator && (designator === '?' || designator === '??' || designator === '***' || designator === '****' || designator === '*')) {
      designator = '';
    }
    if (designator && designator.length > 0) {
      analysisComponentIdToDesignator.set(comp.id, designator);
    }
  }
  
  // Analyze all nets to identify connections, ground, and power buses
  const analysisGroundNets: Array<{ netId: number; nodeCount: number; nodeIds: number[] }> = [];
  const analysisPowerBusesByVoltage = new Map<string, Array<{ netId: number; nodeCount: number; nodeIds: number[] }>>();
  const analysisSignalNets: Array<{ netId: number; netName: string; componentPins: Array<{ designator: string; pin: number; nodeId: number }>; nodeCount: number }> = [];
  
  for (const [rootNodeId, netNodes] of netGroups) {
    const netName = netNames.get(rootNodeId) || `N$${rootNodeId}`;
    
    // Check for ground nodes
    const groundNodes = netNodes.filter(n => n.type === 'ground');
    if (groundNodes.length > 0) {
      analysisGroundNets.push({
        netId: rootNodeId,
        nodeCount: netNodes.length,
        nodeIds: netNodes.map(n => n.id),
      });
      continue;
    }
    
    // Check for power nodes
    const powerNodes = netNodes.filter(n => n.type === 'power');
    if (powerNodes.length > 0) {
      // Group by normalized voltage - each voltage is a separate power bus
      const voltageMap = new Map<string, NetlistNode[]>();
      for (const node of powerNodes) {
        if (node.voltage) {
          // Normalize voltage using the same logic as groupNodesIntoNets
          const normalizedVoltage = normalizeVoltage(node.voltage);
          if (!voltageMap.has(normalizedVoltage)) {
            voltageMap.set(normalizedVoltage, []);
          }
          voltageMap.get(normalizedVoltage)!.push(node);
        }
      }
      
      // Each normalized voltage represents a separate power bus
      for (const [voltage] of voltageMap) {
        if (!analysisPowerBusesByVoltage.has(voltage)) {
          analysisPowerBusesByVoltage.set(voltage, []);
        }
        analysisPowerBusesByVoltage.get(voltage)!.push({
          netId: rootNodeId,
          nodeCount: netNodes.length,
          nodeIds: netNodes.map(n => n.id),
        });
      }
      continue;
    }
    
    // Signal nets (not power or ground)
    const analysisComponentPins: Array<{ designator: string; pin: number; nodeId: number }> = [];
    for (const node of netNodes) {
      if (node.type === 'component_pin' && node.componentId && node.pinIndex !== undefined) {
        const designator = analysisComponentIdToDesignator.get(node.componentId);
        if (designator) {
          analysisComponentPins.push({
            designator,
            pin: (node.pinIndex || 0) + 1,
            nodeId: node.id,
          });
        }
      }
    }
    
    if (analysisComponentPins.length > 0 || netNodes.length > 0) {
      analysisSignalNets.push({
        netId: rootNodeId,
        netName,
        componentPins: analysisComponentPins,
        nodeCount: netNodes.length,
      });
    }
  }
  
  // Log comprehensive analysis results
  console.log(`\n[Schematic Analysis] GROUND ANALYSIS:`);
  if (analysisGroundNets.length === 0) {
    console.log(`  No ground nets found`);
  } else if (analysisGroundNets.length === 1) {
    console.log(`  ✓ Single common ground plane identified`);
    console.log(`    - Net ID: ${analysisGroundNets[0].netId}`);
    console.log(`    - Total nodes: ${analysisGroundNets[0].nodeCount}`);
    console.log(`    - All ${analysisGroundNets[0].nodeCount} ground points are connected`);
  } else {
    console.log(`  ⚠ WARNING: Multiple ground nets found (${analysisGroundNets.length})`);
    for (const groundNet of analysisGroundNets) {
      console.log(`    - Net ID ${groundNet.netId}: ${groundNet.nodeCount} nodes`);
    }
    console.log(`  Note: All ground points should be in a single net (common ground plane)`);
  }
  
  console.log(`\n[Schematic Analysis] POWER BUS ANALYSIS:`);
  if (analysisPowerBusesByVoltage.size === 0) {
    console.log(`  No power buses found`);
  } else {
    console.log(`  ✓ Found ${analysisPowerBusesByVoltage.size} distinct power bus(es) by voltage:`);
    for (const [voltage, buses] of analysisPowerBusesByVoltage) {
      console.log(`\n  Power Bus: ${voltage}`);
      if (buses.length === 1) {
        console.log(`    - Single net (Net ID: ${buses[0].netId})`);
        console.log(`    - Total nodes: ${buses[0].nodeCount}`);
        console.log(`    - All power nodes at ${voltage} are connected`);
      } else {
        console.log(`    - ⚠ WARNING: ${voltage} appears in ${buses.length} separate nets:`);
        for (const bus of buses) {
          console.log(`      * Net ID ${bus.netId}: ${bus.nodeCount} nodes`);
        }
        console.log(`    - Note: All power nodes with the same voltage should be in a single net`);
      }
    }
  }
  
  console.log(`\n[Schematic Analysis] COMPONENT CONNECTIONS:`);
  const analysisComponentConnections = new Map<string, Array<{ pin: number; netName: string; nodeId: number }>>();
  for (const signalNet of analysisSignalNets) {
    for (const pinInfo of signalNet.componentPins) {
      if (!analysisComponentConnections.has(pinInfo.designator)) {
        analysisComponentConnections.set(pinInfo.designator, []);
      }
      analysisComponentConnections.get(pinInfo.designator)!.push({
        pin: pinInfo.pin,
        netName: signalNet.netName,
        nodeId: pinInfo.nodeId,
      });
    }
  }
  
  console.log(`  Total components with connections: ${analysisComponentConnections.size}`);
  if (analysisComponentConnections.size > 0) {
    console.log(`  Sample component connections (first 10):`);
    let count = 0;
    for (const [designator, pins] of analysisComponentConnections) {
      if (count++ >= 10) break;
      const pinList = pins.map(p => `pin${p.pin}→${p.netName}`).join(', ');
      console.log(`    - ${designator}: ${pins.length} pins connected (${pinList})`);
    }
  }
  
  console.log(`\n[Schematic Analysis] SIGNAL NET SUMMARY:`);
  const analysisNetsWithPins = analysisSignalNets.filter(n => n.componentPins.length > 0);
  const analysisNetsWith2PlusPins = analysisSignalNets.filter(n => n.componentPins.length >= 2);
  console.log(`  - Total signal nets: ${analysisSignalNets.length}`);
  console.log(`  - Nets with component pins: ${analysisNetsWithPins.length}`);
  console.log(`  - Nets with 2+ component pins: ${analysisNetsWith2PlusPins.length}`);
  console.log(`  - Isolated nets (no component pins): ${analysisSignalNets.length - analysisNetsWithPins.length}`);
  
  if (analysisNetsWith2PlusPins.length > 0) {
    console.log(`\n  Sample signal nets with 2+ pins (first 5):`);
    let count = 0;
    for (const net of analysisNetsWith2PlusPins) {
      if (count++ >= 5) break;
      const pinList = net.componentPins.map(p => `${p.designator}:pin${p.pin}`).join(', ');
      console.log(`    - ${net.netName}: ${net.componentPins.length} pins (${pinList})`);
    }
  }
  
  console.log(`\n[Schematic Analysis] ========================================`);
  console.log(`[Schematic Analysis] Analysis complete`);
  console.log(`[Schematic Analysis] ========================================\n`);
  
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
        // Clean voltage string for KiCad: ensure +/- prefix and V suffix
        const voltage = node.voltage || powerVoltage || '';
        if (voltage) {
          // Format voltage to KiCad standard notation (+5V, -3V3, etc.)
          powerVoltage = formatVoltageKiCad(voltage);
        }
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

  // Layout components using graph-based algorithms
  // Include all components that have designators (prioritize designator over abbreviation)
  const componentsWithDesignators = components.filter(c => {
    let d = c.designator?.trim() || (c as any).abbreviation?.trim();
    // Filter out placeholder values
    if (d && (d === '?' || d === '??' || d === '***' || d === '****' || d === '*')) {
      d = ''; // Treat placeholders as empty
    }
    return !!d && d.length > 0; // Must have a non-empty designator
  });

  /**
   * Build connectivity graph for components based on shared nets
   * This enables functional block clustering and improved layout
   */
  const buildComponentConnectivityGraph = (): Map<string, Set<string>> => {
    const graph = new Map<string, Set<string>>();
    
    // Initialize graph nodes
    for (const comp of componentsWithDesignators) {
      const designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
      if (designator && designator.length > 0) {
        graph.set(designator, new Set());
      }
    }
    
    // Build edges: components sharing nets are connected
    for (const net of nets) {
      if (net.componentPins.length >= 2) {
        // All components in this net are connected to each other
        const designators = net.componentPins.map(p => p.designator);
        for (let i = 0; i < designators.length; i++) {
          for (let j = i + 1; j < designators.length; j++) {
            const d1 = designators[i];
            const d2 = designators[j];
            if (graph.has(d1) && graph.has(d2)) {
              graph.get(d1)!.add(d2);
              graph.get(d2)!.add(d1);
            }
          }
        }
      }
    }
    
    return graph;
  };

  /**
   * Simple functional block clustering using connected components
   * Groups components that share many connections together
   */
  const clusterComponents = (componentGraph: Map<string, Set<string>>): Map<string, number> => {
    const clusters = new Map<string, number>();
    const visited = new Set<string>();
    let clusterId = 0;
    
    // Simple clustering: DFS to find connected components
    const dfs = (designator: string, currentCluster: number) => {
      if (visited.has(designator)) return;
      visited.add(designator);
      clusters.set(designator, currentCluster);
      
      const neighbors = componentGraph.get(designator);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor, currentCluster);
          }
        }
      }
    };
    
    // Find all clusters
    for (const designator of componentGraph.keys()) {
      if (!visited.has(designator)) {
        dfs(designator, clusterId++);
      }
    }
    
    return clusters;
  };

  // Build component connectivity graph for improved layout
  const componentGraph = buildComponentConnectivityGraph();
  const componentClusters = clusterComponents(componentGraph);
  
  // Log clustering information
  const clusterCounts = new Map<number, number>();
  for (const clusterId of componentClusters.values()) {
    clusterCounts.set(clusterId, (clusterCounts.get(clusterId) || 0) + 1);
  }
  console.log(`[Schematic] Component clustering: ${clusterCounts.size} functional blocks identified`);
  for (const [clusterId, count] of clusterCounts) {
    console.log(`  Cluster ${clusterId}: ${count} components`);
  }

  // Use PCB coordinates to preserve geometric relationships
  // Scale and translate PCB coordinates (pixels) to schematic coordinates (mm)
  // Declare variables outside if block so they're available for power/ground symbol placement
  let offsetX = 30; // Default margin
  let offsetY = 30; // Default margin
  let scaledWidth = 0;
  let scaledHeight = 0;
  
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
    
    // Calculate scale factor to fit components within A3 paper bounds
    // A3 paper: 297mm x 420mm
    // Leave margins for labels and power/ground symbols
    const pcbWidth = maxX - minX;
    const pcbHeight = maxY - minY;
    
    // Usable area within A3 paper (297mm x 420mm) with margins
    const margin = 30; // 30mm margin on all sides
    const usableWidth = 297 - (2 * margin);  // ~237mm usable width
    const usableHeight = 420 - (2 * margin);  // ~360mm usable height
    
    // Calculate scale to fit PCB layout within usable area
    // Use the smaller scale factor to ensure everything fits (preserves aspect ratio)
    const scaleX = pcbWidth > 0 ? usableWidth / pcbWidth : 0.1;
    const scaleY = pcbHeight > 0 ? usableHeight / pcbHeight : 0.1;
    let scale = Math.min(scaleX, scaleY);
    
    // Ensure scale is reasonable (not too small or too large)
    // Minimum: 0.5mm per pixel (prevents components from being too close/overlapping)
    // Maximum: 2.0mm per pixel (prevents components from being too far apart)
    const minScale = 0.5;
    const maxScale = 2.0;
    scale = Math.max(minScale, Math.min(scale, maxScale));
    
    // Calculate actual bounds after scaling
    scaledWidth = pcbWidth * scale;
    scaledHeight = pcbHeight * scale;
    
    // Center the layout within the usable area
    offsetX = margin + (usableWidth - scaledWidth) / 2;
    offsetY = margin + (usableHeight - scaledHeight) / 2;
    
    // Map components using PCB coordinates
    // Components in the same cluster are placed closer together (preserved by PCB coordinates)
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
        // This preserves spatial relationships and naturally groups connected components
        const schematicX = (comp.x - minX) * scale + offsetX;
        const schematicY = (comp.y - minY) * scale + offsetY;
        
        componentMap.set(designator, { comp, designator, x: schematicX, y: schematicY });
      }
    }
    
    // Log positioning information for debugging
    console.log(`[Schematic] Component positioning: ${componentMap.size} components`);
    console.log(`[Schematic] PCB bounds: ${minX.toFixed(1)}, ${minY.toFixed(1)} to ${maxX.toFixed(1)}, ${maxY.toFixed(1)}`);
    console.log(`[Schematic] PCB size: ${pcbWidth.toFixed(1)} x ${pcbHeight.toFixed(1)} pixels`);
    console.log(`[Schematic] Usable area: ${usableWidth.toFixed(1)} x ${usableHeight.toFixed(1)} mm (A3 paper with ${margin}mm margins)`);
    console.log(`[Schematic] Scale factor: ${scale.toFixed(4)} (${(1/scale).toFixed(2)} pixels per mm)`);
    console.log(`[Schematic] Scaled size: ${scaledWidth.toFixed(1)} x ${scaledHeight.toFixed(1)} mm`);
    console.log(`[Schematic] Schematic bounds: ${offsetX.toFixed(1)}mm, ${offsetY.toFixed(1)}mm to ${(offsetX + scaledWidth).toFixed(1)}mm, ${(offsetY + scaledHeight).toFixed(1)}mm`);
  }

  // Generate KiCad schematic
  let schematic = '(kicad_sch (version 20201015) (generator simple_schematic)\n';
  // Use A3 paper size to accommodate larger layouts that preserve PCB spatial relationships
  // A3 is 297mm x 420mm, which gives more room than A4 (210mm x 297mm)
  schematic += '  (paper "A3")\n';
  // Note: Grid settings are view preferences in KiCad, not stored in the schematic file
  // Users can set grid to 100mm in KiCad's view settings after opening the schematic
  // Reference to external symbol library (kicadunlocked.kicad_sym)
  // Note: KiCad schematics reference symbol libraries when placing symbols, not in the header
  // The library file should be available in kicad/symbols/kicadunlocked.kicad_sym
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
  // GND symbol points DOWN (negative Y values)
  schematic += '    (symbol "simple:Ground" (pin_names (offset 1.016)) (in_bom no) (on_board no)\n';
  schematic += '      (property "Reference" "#PWR" (id 0) (at 0 0 0)\n';
  schematic += '        (effects (font (size 1.27 1.27)) hide)\n';
  schematic += '      )\n';
  schematic += '      (symbol "Ground_0_1"\n';
  schematic += '        (polyline (pts (xy 0 0) (xy 0 -2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -2.54 -2.54) (xy 2.54 -2.54)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -1.27 -3.81) (xy 1.27 -3.81)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
  schematic += '        (polyline (pts (xy -0.635 -4.445) (xy 0.635 -4.445)) (stroke (width 0.254) (type default)) (fill (type none)))\n';
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
  
  // Helper function to generate a multi-pin symbol with the correct number of pins
  const generateMultiPinSymbol = (symbolName: string, refPrefix: string, maxPins: number = 20) => {
    // Extract the base symbol name (e.g., "IC" from "simple:IC")
    const baseSymbolName = symbolName.includes(':') ? symbolName.split(':')[1] : symbolName;
    
    schematic += `    (symbol "${symbolName}" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)\n`;
    schematic += `      (property "Reference" "${refPrefix}" (id 0) (at 0 2.54 0)\n`;
    schematic += '        (effects (font (size 1.27 1.27)))\n';
    schematic += '      )\n';
    schematic += '      (property "Value" "VAL" (id 1) (at 0 -2.54 0)\n';
    schematic += '        (effects (font (size 1.27 1.27)))\n';
    schematic += '      )\n';
    schematic += `      (symbol "${baseSymbolName}_0_1"\n`;
    schematic += '        (rectangle (start -5.08 -3.81) (end 5.08 3.81)\n';
    schematic += '          (stroke (width 0.254)) (fill (type background))\n';
    schematic += '        )\n';
    schematic += '      )\n';
    // Generate symbol variants for different pin counts (1-20 pins)
    for (let pinCount = 1; pinCount <= maxPins; pinCount++) {
      schematic += `      (symbol "${baseSymbolName}_1_${pinCount}"\n`;
      const pinsPerLeftSide = Math.ceil(pinCount / 2);
      const pinsPerRightSide = Math.floor(pinCount / 2);
      
      // Left side pins
      for (let i = 0; i < pinsPerLeftSide; i++) {
        const pinNum = i + 1;
        const pinY = pinsPerLeftSide > 1 
          ? -((pinsPerLeftSide - 1) * 2.54 / 2) + (i * 2.54)
          : 0;
        const pinX = -5.08;
        schematic += `        (pin passive line (at ${pinX} ${pinY} 0) (length 2.54)\n`;
        schematic += `          (name "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
        schematic += `          (number "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
        schematic += '        )\n';
      }
      
      // Right side pins
      for (let i = 0; i < pinsPerRightSide; i++) {
        const pinNum = pinsPerLeftSide + i + 1;
        const pinY = pinsPerRightSide > 1
          ? -((pinsPerRightSide - 1) * 2.54 / 2) + (i * 2.54)
          : 0;
        const pinX = 5.08;
        schematic += `        (pin passive line (at ${pinX} ${pinY} 180) (length 2.54)\n`;
        schematic += `          (name "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
        schematic += `          (number "${pinNum}" (effects (font (size 1.27 1.27))))\n`;
        schematic += '        )\n';
      }
      schematic += '      )\n';
    }
    schematic += '    )\n';
  };
  
  // Integrated Circuit symbol (with configurable pin counts)
  generateMultiPinSymbol('simple:IC', 'U', 20);
  
  // Generic symbol for other component types (fallback)
  generateMultiPinSymbol('simple:Generic', 'REF', 20);
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
    
    // Reference the library symbol - use the correct unit based on pin count
    // For multi-pin symbols (IC, Generic), unit corresponds to pin count
    const actualPinCount = comp.pinCount || 2;
    let symbolUnit = 1;
    if (symbolLibId === 'simple:IC' || symbolLibId === 'simple:Generic') {
      // Unit number corresponds to pin count (1-20)
      symbolUnit = Math.min(Math.max(actualPinCount, 1), 20);
    }
    
    schematic += `  (symbol (lib_id "${symbolLibId}") (at ${info.x} ${info.y} ${rotation}) (unit ${symbolUnit})\n`;
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
  // Optimization strategy: Minimize net labels by using direct wire connections
  // - Connect all pins in a net with wires when possible
  // - Only add labels for: power/ground (for clarity), single-pin nets, or disconnected pins
  // - This reduces schematic clutter and follows KiCad best practices
  schematic += '\n';
  
  // Place power and ground symbols
  // Position them near the components (to the right of the component area)
  let powerGroundX = offsetX + scaledWidth + 20; // 20mm to the right of components
  let powerGroundY = offsetY + scaledHeight / 2; // Vertically centered with components
  const powerGroundSpacing = 15; // Spacing between power/ground symbols
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
    
    // Build connection graph from PCB traces to preserve layout relationships
    // Map: pinKey (designator:pin) -> array of connected pinKeys through traces
    const pinConnectionGraph = new Map<string, Set<string>>();
    
    // Initialize graph with all pins
    for (const pinPos of pinPositions) {
      const pinKey = `${pinPos.designator}:${pinPos.pin}`;
      if (!pinConnectionGraph.has(pinKey)) {
        pinConnectionGraph.set(pinKey, new Set());
      }
    }
    
    // Build connections from PCB traces: find which component pins are connected through traces
    // We'll use the net's component pins and trace information to build a connection graph
    const pinKeyToNodeId = new Map<string, number>();
    for (const pinInfo of net.componentPins) {
      const comp = components.find(c => {
        const d = (c as any).abbreviation?.trim() || c.designator?.trim();
        return d === pinInfo.designator;
      });
      if (comp && comp.pinConnections && comp.pinConnections[pinInfo.pin - 1]) {
        const nodeIdStr = comp.pinConnections[pinInfo.pin - 1];
        const nodeId = parseInt(nodeIdStr.trim(), 10);
        if (!isNaN(nodeId)) {
          const pinKey = `${pinInfo.designator}:${pinInfo.pin}`;
          pinKeyToNodeId.set(pinKey, nodeId);
        }
      }
    }
    
    // Build connectivity graph from all traces ONCE (handles transitive connections)
    // This is more efficient than building it for each pair of nodes
    const nodeConnectivityGraph = new Map<number, Set<number>>();
    
    // Initialize graph for all nodes
    for (const nodeId of nodes.keys()) {
      if (!nodeConnectivityGraph.has(nodeId)) {
        nodeConnectivityGraph.set(nodeId, new Set());
      }
    }
    
    // Add edges from traces: consecutive points in a trace are connected
    for (const stroke of drawingStrokes) {
      if (stroke.type === 'trace' && stroke.points.length >= 2) {
        const nodeIdsInTrace = stroke.points
          .map(p => p.id)
          .filter(id => id !== undefined && nodes.has(id!)) as number[];
        
        // Connect consecutive nodes in the trace (bidirectional)
        for (let i = 0; i < nodeIdsInTrace.length - 1; i++) {
          const nodeA = nodeIdsInTrace[i];
          const nodeB = nodeIdsInTrace[i + 1];
          if (nodeA !== undefined && nodeB !== undefined) {
            if (!nodeConnectivityGraph.has(nodeA)) {
              nodeConnectivityGraph.set(nodeA, new Set());
            }
            if (!nodeConnectivityGraph.has(nodeB)) {
              nodeConnectivityGraph.set(nodeB, new Set());
            }
            nodeConnectivityGraph.get(nodeA)!.add(nodeB);
            nodeConnectivityGraph.get(nodeB)!.add(nodeA);
          }
        }
      }
    }
    
    // Helper function to check if two nodes are connected (uses pre-built graph with BFS)
    function areNodesConnected(nodeId1: number, nodeId2: number): boolean {
      // If nodes are the same, they're trivially connected
      if (nodeId1 === nodeId2) {
        return true;
      }
      
      // Use BFS to check connectivity in the pre-built graph
      if (!nodeConnectivityGraph.has(nodeId1) || !nodeConnectivityGraph.has(nodeId2)) {
        return false; // One or both nodes not in the graph
      }
      
      const visited = new Set<number>();
      const queue: number[] = [nodeId1];
      visited.add(nodeId1);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        
        if (current === nodeId2) {
          return true; // Found path to target node
        }
        
        const neighbors = nodeConnectivityGraph.get(current);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }
      
      return false; // No path found
    }
    
    // Find connections through traces: if two pins share the same node ID or are connected via trace path
    for (const [pinKey1, nodeId1] of pinKeyToNodeId) {
      for (const [pinKey2, nodeId2] of pinKeyToNodeId) {
        if (pinKey1 !== pinKey2) {
          // Check if they're connected through traces (same node ID or connected via trace path)
          if (nodeId1 === nodeId2 || areNodesConnected(nodeId1, nodeId2)) {
            pinConnectionGraph.get(pinKey1)!.add(pinKey2);
            pinConnectionGraph.get(pinKey2)!.add(pinKey1);
          }
        }
      }
    }
    
    // Create connections following PCB trace topology (minimum spanning tree approach)
    // This preserves the spatial relationships from the PCB layout
    if (pinPositions.length >= 1) {
      // Calculate center point for labels and power/ground connections
      const centerX = pinPositions.length > 1 
        ? pinPositions.reduce((sum, p) => sum + p.x, 0) / pinPositions.length
        : pinPositions[0].x + 10;
      const centerY = pinPositions.length > 1
        ? pinPositions.reduce((sum, p) => sum + p.y, 0) / pinPositions.length
        : pinPositions[0].y;
      
      // Connect to power symbol if this is a power net
      if (net.hasPower && net.powerVoltage) {
        const powerKey = `PWR_${net.powerVoltage}`;
        const powerSymbol = powerGroundSymbols.get(powerKey);
        if (powerSymbol) {
          const powerConnectionY = powerSymbol.y - 2.54;
          const powerConnectionX = powerSymbol.x;
          
          const powerJunctionUuid = generateUuid();
          schematic += `  (junction (at ${powerConnectionX} ${powerConnectionY}) (diameter 0) (color 0 0 0 0) (uuid ${powerJunctionUuid}))\n`;
          
          // Connect to nearest component pin (or center if multiple pins)
          const connectionPoint = pinPositions.length === 1 
            ? pinPositions[0] 
            : { x: centerX, y: centerY };
          const powerWireUuid = generateUuid();
          schematic += `  (wire (pts (xy ${connectionPoint.x} ${connectionPoint.y}) (xy ${powerConnectionX} ${powerConnectionY})) (stroke (width 0) (type default)) (uuid ${powerWireUuid}))\n`;
        }
      }
      
      // Connect to ground symbol if this is a ground net
      if (net.hasGround) {
        const groundKey = 'GND';
        const groundSymbol = powerGroundSymbols.get(groundKey);
        if (groundSymbol) {
          // GND symbol points down, so connection point is above the symbol (negative Y offset)
          const groundConnectionY = groundSymbol.y - 2.54;
          const groundConnectionX = groundSymbol.x;
          
          const groundJunctionUuid = generateUuid();
          schematic += `  (junction (at ${groundConnectionX} ${groundConnectionY}) (diameter 0) (color 0 0 0 0) (uuid ${groundJunctionUuid}))\n`;
          
          // Connect to nearest component pin (or center if multiple pins)
          const connectionPoint = pinPositions.length === 1 
            ? pinPositions[0] 
            : { x: centerX, y: centerY };
          const groundWireUuid = generateUuid();
          schematic += `  (wire (pts (xy ${connectionPoint.x} ${connectionPoint.y}) (xy ${groundConnectionX} ${groundConnectionY})) (stroke (width 0) (type default)) (uuid ${groundWireUuid}))\n`;
        }
      }
      
      // Track which pins are connected with wires (for label decision)
      const connectedPins = new Set<string>();
      
      // Route wires following PCB trace topology
      if (pinPositions.length >= 2) {
        console.log(`[Schematic] Creating wires for net ${net.name}: ${pinPositions.length} pins`);
        
        // Build a map from pinKey to pinPosition
        const pinKeyToPosition = new Map<string, { x: number; y: number }>();
        for (const pinPos of pinPositions) {
          const pinKey = `${pinPos.designator}:${pinPos.pin}`;
          pinKeyToPosition.set(pinKey, { x: pinPos.x, y: pinPos.y });
        }
        
        // Use minimum spanning tree to connect pins while preserving spatial relationships
        // Sort pins by distance from each other to create a more natural routing
        const edges: Array<{ from: string; to: string; distance: number }> = [];
        
        // Calculate distances between all connected pins
        for (const [pinKey1, connections] of pinConnectionGraph) {
          for (const pinKey2 of connections) {
            if (pinKeyToPosition.has(pinKey1) && pinKeyToPosition.has(pinKey2)) {
              const pos1 = pinKeyToPosition.get(pinKey1)!;
              const pos2 = pinKeyToPosition.get(pinKey2)!;
              const distance = Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
              edges.push({ from: pinKey1, to: pinKey2, distance });
            }
          }
        }
        
        // If we have explicit connections from traces, use them
        // Otherwise, create a minimum spanning tree based on spatial proximity
        if (edges.length > 0) {
          // Sort edges by distance (prefer shorter connections)
          edges.sort((a, b) => a.distance - b.distance);
          
          // Use Kruskal's algorithm to build minimum spanning tree
          const parent = new Map<string, string>();
          const find = (key: string): string => {
            if (!parent.has(key)) parent.set(key, key);
            if (parent.get(key) !== key) {
              parent.set(key, find(parent.get(key)!));
            }
            return parent.get(key)!;
          };
          const union = (a: string, b: string) => {
            const rootA = find(a);
            const rootB = find(b);
            if (rootA !== rootB) {
              parent.set(rootB, rootA);
              return true;
            }
            return false;
          };
          
          // Add edges to form minimum spanning tree
          for (const edge of edges) {
            if (union(edge.from, edge.to)) {
              const pos1 = pinKeyToPosition.get(edge.from)!;
              const pos2 = pinKeyToPosition.get(edge.to)!;
              const wireUuid = generateUuid();
              schematic += `  (wire (pts (xy ${pos1.x} ${pos1.y}) (xy ${pos2.x} ${pos2.y})) (stroke (width 0) (type default)) (uuid ${wireUuid}))\n`;
              connectedPins.add(edge.from);
              connectedPins.add(edge.to);
            }
          }
        } else {
          // Fallback: if no explicit trace connections, use spatial proximity
          // For 2 pins: direct connection
          if (pinPositions.length === 2) {
            const wireUuid = generateUuid();
            schematic += `  (wire (pts (xy ${pinPositions[0].x} ${pinPositions[0].y}) (xy ${pinPositions[1].x} ${pinPositions[1].y})) (stroke (width 0) (type default)) (uuid ${wireUuid}))\n`;
            // Track connected pins
            connectedPins.add(`${pinPositions[0].designator}:${pinPositions[0].pin}`);
            connectedPins.add(`${pinPositions[1].designator}:${pinPositions[1].pin}`);
          } else {
            // For 3+ pins: connect in a chain based on spatial proximity
            // Sort pins by position (left to right, top to bottom)
            const sortedPins = [...pinPositions].sort((a, b) => {
              if (Math.abs(a.y - b.y) < 5) { // Same row
                return a.x - b.x;
              }
              return a.y - b.y;
            });
            
            // Connect adjacent pins in the sorted order
            for (let i = 0; i < sortedPins.length - 1; i++) {
              const wireUuid = generateUuid();
              schematic += `  (wire (pts (xy ${sortedPins[i].x} ${sortedPins[i].y}) (xy ${sortedPins[i + 1].x} ${sortedPins[i + 1].y})) (stroke (width 0) (type default)) (uuid ${wireUuid}))\n`;
              // Track connected pins
              connectedPins.add(`${sortedPins[i].designator}:${sortedPins[i].pin}`);
              connectedPins.add(`${sortedPins[i + 1].designator}:${sortedPins[i + 1].pin}`);
            }
          }
        }
      } else if (pinPositions.length === 1) {
        // Single pin: create a junction at the pin position
        console.log(`[Schematic] Creating junction for single-pin net ${net.name} at (${pinPositions[0].x}, ${pinPositions[0].y})`);
        const pinJunctionUuid = generateUuid();
        schematic += `  (junction (at ${pinPositions[0].x} ${pinPositions[0].y}) (diameter 0.508) (color 0 0 0 0) (uuid ${pinJunctionUuid}))\n`;
      } else {
        console.warn(`[Schematic] Net ${net.name} has ${net.componentPins.length} component pins but 0 valid pin positions!`);
      }
      
      // Only add labels when necessary to reduce net clutter
      // Strategy: Use direct wire connections where possible, labels only when needed
      // Check if all pins are connected: if MST connects all pins, connectedPins.size should equal pinPositions.length
      const allPinsConnected = pinPositions.length >= 2 && connectedPins.size === pinPositions.length;
      const needsLabel = 
        // Power/ground nets: always label for clarity (even if fully wired)
        net.hasPower || net.hasGround ||
        // Single-pin nets: need label since they can't be wired
        pinPositions.length === 1 ||
        // Nets with disconnected pins (not all pins connected via wires)
        (pinPositions.length >= 2 && !allPinsConnected);
      
      if (needsLabel) {
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
      } else {
        // All pins are connected with wires - no label needed
        console.log(`[Schematic] Net ${net.name}: All ${pinPositions.length} pins connected with wires, skipping label`);
      }
    }
  }

  schematic += ')\n';
  
  // Generate nodes CSV before returning
  // Pass drawingStrokes so we can examine each trace's points directly
  const nodesCsv = generateNodesCsv(nodes, netGroups, netNames, components, drawingStrokes);
  
  return { schematic, nodesCsv };
}

