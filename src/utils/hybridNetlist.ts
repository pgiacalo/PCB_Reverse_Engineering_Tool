/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

// ============================================================================
// Hybrid Net-Centric Netlist with Explicit Nodes
// ============================================================================
// This format combines:
// - Net-centric organization (industry standard)
// - Explicit node definitions with IDs (for AI troubleshooting)
// - Bidirectional references (component pins reference node_id)
// - Test point mapping
// - Expected voltage ranges
// ============================================================================

import type { PCBComponent, DrawingStroke, GroundSymbol } from '../types';
import { 
  buildConnectivityGraph, 
  groupNodesIntoNets, 
  generateNetNames
} from './netlist';
import {
  type NodeOptionalFields,
  type ExpectedVoltage,
  inferNodeProperties,
  inferExpectedVoltage,
  mergeNodeProperties
} from './nodeProperties';

// ============================================================================
// Type Definitions for Hybrid Netlist Format
// ============================================================================

/**
 * Connection within a node
 */
export interface HybridConnection {
  type: 'component_pin' | 'via' | 'pad' | 'trace';
  component?: string;     // For component_pin
  pin?: string;           // For component_pin
  pin_name?: string;      // For component_pin
  pin_type?: string;      // For component_pin (input, output, power, etc.)
  direction?: string;     // For component_pin (input, output, bidirectional)
  ref?: string;           // For via/pad/trace
  x?: number;             // For via/pad (physical location)
  y?: number;             // For via/pad
  layer?: string;         // For via/pad/trace
}

/**
 * Node within a net (explicit node with ID)
 */
export interface HybridNode {
  id: string;
  connections: HybridConnection[];
  expected_voltage?: ExpectedVoltage;
  
  // Optional fields (Phase 1)
  notes?: string;
  criticality?: 'low' | 'medium' | 'high';
  signal_type?: 'digital' | 'analog' | 'power' | 'ground';
  function?: string;
  test_point_id?: string;
  related_nodes?: string[];
}

/**
 * Net containing one or more nodes
 */
export interface HybridNet {
  name: string;
  type: 'power' | 'power_ground' | 'signal';
  nodes: HybridNode[];
}

/**
 * Component pin with node_id reference
 */
export interface HybridPin {
  number: string;
  name: string;
  type: string;
  node_id?: string;       // Reference to node
  test_point?: string;    // Reference to test point if accessible
}

/**
 * Component entry in hybrid netlist
 */
export interface HybridComponent {
  designator: string;
  part_number?: string;
  value?: string;
  tolerance?: string;
  package: string;
  description?: string;
  pins: HybridPin[];
}

/**
 * Test point definition
 */
export interface HybridTestPoint {
  id: string;
  node_id: string;
  location: { x: number; y: number };
  layer: string;
  accessible: 'top' | 'bottom' | 'both';
}

/**
 * Complete hybrid netlist structure
 */
export interface HybridNetlist {
  design_info: {
    name: string;
    version: string;
    date: string;
  };
  components: HybridComponent[];
  nets: HybridNet[];
  test_points: HybridTestPoint[];
}

// ============================================================================
// Interfaces for input data (copied from netlist.ts for independence)
// ============================================================================

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

interface PowerBus {
  id: string;
  name: string;
  voltage: string;
  color: string;
}

interface GroundBus {
  id: string;
  name: string;
  color: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a semantic node ID from net name and internal node ID
 */
function generateSemanticNodeId(netName: string, internalNodeId: number, nodeIndex: number): string {
  // Sanitize net name for use in ID
  const sanitized = netName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // If only one node in net, use simple ID
  if (nodeIndex === 0) {
    return `node_${sanitized || 'signal'}_${internalNodeId}`;
  }
  
  // Multiple nodes in net, add index
  return `node_${sanitized || 'signal'}_${nodeIndex}_${internalNodeId}`;
}

/**
 * Determine net type from name
 */
function determineNetType(netName: string): 'power' | 'power_ground' | 'signal' {
  if (netName === 'GND' || netName.toUpperCase().includes('GROUND')) {
    return 'power_ground';
  }
  if (netName.startsWith('+') || netName.startsWith('-')) {
    return 'power';
  }
  return 'signal';
}

/**
 * Get component value string with units
 */
function getComponentValueString(comp: PCBComponent): string | undefined {
  // Resistor
  if (comp.componentType === 'Resistor' && 'resistance' in comp) {
    const resistance = (comp as any).resistance;
    const unit = (comp as any).resistanceUnit || 'Ω';
    if (resistance && String(resistance).trim() !== '') {
      return `${resistance}${unit}`;
    }
  }
  
  // Capacitor
  if ((comp.componentType === 'Capacitor' || 
       comp.componentType === 'Electrolytic Capacitor' || 
       comp.componentType === 'Film Capacitor') && 'capacitance' in comp) {
    const capacitance = (comp as any).capacitance;
    const unit = (comp as any).capacitanceUnit || 'F';
    if (capacitance && String(capacitance).trim() !== '') {
      return `${capacitance}${unit}`;
    }
  }
  
  // Inductor
  if (comp.componentType === 'Inductor' && 'inductance' in comp) {
    const inductance = (comp as any).inductance;
    const unit = (comp as any).inductanceUnit || 'H';
    if (inductance && String(inductance).trim() !== '') {
      return `${inductance}${unit}`;
    }
  }
  
  return undefined;
}

/**
 * Infer pin type from name
 */
function inferPinType(pinName: string): string {
  if (!pinName || pinName.trim() === '') return 'unknown';
  
  const upperName = pinName.toUpperCase();
  
  // Power pins
  if (upperName === 'VCC' || upperName === 'VDD' || upperName === 'V+' ||
      upperName.startsWith('VIN') || upperName.startsWith('VOUT') ||
      upperName.includes('POWER')) {
    return 'power';
  }
  
  // Ground pins
  if (upperName === 'GND' || upperName === 'VSS' || upperName === 'V-' ||
      upperName.includes('GROUND')) {
    return 'power';  // Ground is also a power type
  }
  
  // Input pins
  if (upperName.includes('IN') && !upperName.includes('OUT')) {
    return 'input';
  }
  
  // Output pins
  if (upperName.includes('OUT') && !upperName.includes('IN')) {
    return 'output';
  }
  
  // Bidirectional (I/O)
  if (upperName.includes('I/O') || upperName.includes('IO') ||
      (upperName.includes('IN') && upperName.includes('OUT'))) {
    return 'bidirectional';
  }
  
  // Clock pins
  if (upperName.includes('CLK') || upperName.includes('CLOCK') ||
      upperName.includes('OSC') || upperName.includes('XTAL')) {
    return 'input';
  }
  
  // Default for passives
  return 'passive';
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate Hybrid Net-Centric netlist with explicit nodes
 */
export function generateHybridNetlist(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[],
  groundBuses: GroundBus[],
  projectName: string = 'PCB_Design',
  userNodeProperties: Map<number, NodeOptionalFields> = new Map()
): string {
  console.log(`[HybridNetlist] Building connectivity graph...`);
  
  // Build connectivity graph using existing netlist.ts functions
  const nodes = buildConnectivityGraph(
    drawingStrokes,
    components,
    powerSymbols,
    groundSymbols,
    powerBuses,
    groundBuses
  );
  
  // Build connections from traces
  const connections: Array<[number, number]> = [];
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'trace' && stroke.points.length >= 2) {
      const nodesInTrace: Array<{ index: number; nodeId: number }> = [];
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        if (point && point.id !== undefined) {
          nodesInTrace.push({ index: i, nodeId: point.id });
        }
      }
      
      // Connect all nodes in this trace
      for (let i = 0; i < nodesInTrace.length; i++) {
        for (let j = i + 1; j < nodesInTrace.length; j++) {
          const nodeId1 = nodesInTrace[i].nodeId;
          const nodeId2 = nodesInTrace[j].nodeId;
          if (nodeId1 !== nodeId2) {
            connections.push([nodeId1, nodeId2]);
          }
        }
      }
    }
  }
  console.log(`[HybridNetlist] Built ${connections.length} trace connections`);
  
  // Group nodes into nets
  const netGroups = groupNodesIntoNets(nodes, connections, powerBuses, groundBuses);
  const netNames = generateNetNames(netGroups, nodes);
  
  // Build component lookup map
  const componentMap = new Map<string, PCBComponent>();
  for (const comp of components) {
    componentMap.set(comp.id, comp);
  }
  
  // Build node ID to semantic ID mapping
  const nodeIdToSemanticId = new Map<number, string>();
  
  // Extract test points from drawing strokes
  const testPoints: HybridTestPoint[] = [];
  const nodeIdToTestPoint = new Map<number, string>();
  
  for (const stroke of drawingStrokes) {
    if (stroke.type === 'testPoint' && stroke.points.length > 0) {
      const point = stroke.points[0];
      if (point.id !== undefined) {
        const testPointId = stroke.id || `TP_${testPoints.length + 1}`;
        const semanticNodeId = `node_tp_${point.id}`;
        
        testPoints.push({
          id: testPointId,
          node_id: semanticNodeId,
          location: { x: point.x, y: point.y },
          layer: stroke.layer,
          accessible: stroke.layer === 'top' ? 'top' : 'bottom'
        });
        
        nodeIdToTestPoint.set(point.id, testPointId);
      }
    }
  }
  console.log(`[HybridNetlist] Found ${testPoints.length} test points`);
  
  // Build hybrid nets
  const hybridNets: HybridNet[] = [];
  
  for (const [rootNodeId, netNodes] of netGroups) {
    const netName = netNames.get(rootNodeId);
    if (!netName) continue;
    
    const netType = determineNetType(netName);
    
    // Build connections for this net's nodes
    const hybridConnections: HybridConnection[] = [];
    
    for (const node of netNodes) {
      // Component pin connections
      if (node.componentId && node.pinIndex !== undefined) {
        const comp = componentMap.get(node.componentId);
        if (comp) {
          const designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
          const pinNumber = String(node.pinIndex + 1);
          
          // Get pin name and type
          const pinData = (comp as any).pinData as Array<{ name: string; type?: string }> | undefined;
          const pinNames = (comp as any).pinNames as string[] | undefined;
          
          let pinName = pinNumber;
          if (pinData && node.pinIndex < pinData.length && pinData[node.pinIndex]?.name?.trim()) {
            pinName = pinData[node.pinIndex].name.trim();
          } else if (pinNames && node.pinIndex < pinNames.length && pinNames[node.pinIndex]?.trim()) {
            pinName = pinNames[node.pinIndex].trim();
          }
          
          const pinType = pinData?.[node.pinIndex]?.type || inferPinType(pinName);
          
          hybridConnections.push({
            type: 'component_pin',
            component: designator,
            pin: pinNumber,
            pin_name: pinName,
            pin_type: pinType
          });
        }
      }
      
      // Via connections
      if (node.type === 'via') {
        hybridConnections.push({
          type: 'via',
          ref: `via_${node.id}`,
          x: node.x,
          y: node.y
        });
      }
      
      // Pad connections
      if (node.type === 'pad') {
        hybridConnections.push({
          type: 'pad',
          ref: `pad_${node.id}`,
          x: node.x,
          y: node.y
        });
      }
    }
    
    // Skip empty nets (no connections)
    if (hybridConnections.length === 0 && netType === 'signal') {
      continue;
    }
    
    // Generate semantic node ID for the main node
    const semanticNodeId = generateSemanticNodeId(netName, rootNodeId, 0);
    nodeIdToSemanticId.set(rootNodeId, semanticNodeId);
    
    // Auto-infer node properties
    const inferredProps = inferNodeProperties(netName, netType);
    const userProps = userNodeProperties.get(rootNodeId);
    const mergedProps = mergeNodeProperties(inferredProps, userProps);
    
    // Build the hybrid node
    const hybridNode: HybridNode = {
      id: semanticNodeId,
      connections: hybridConnections,
      expected_voltage: inferExpectedVoltage(netName, netType),
      ...mergedProps
    };
    
    // Add test point reference if this net contains a test point
    for (const node of netNodes) {
      const testPointId = nodeIdToTestPoint.get(node.id);
      if (testPointId) {
        hybridNode.test_point_id = testPointId;
        break;
      }
    }
    
    hybridNets.push({
      name: netName,
      type: netType,
      nodes: [hybridNode]
    });
  }
  
  // CRITICAL: Merge nets with the same name
  // Multiple net groups might have the same name (e.g., "GND") if they have the same groundBusId
  // They should be merged into a single net with multiple nodes (or combined connections)
  const netsByName = new Map<string, HybridNet>();
  
  for (const net of hybridNets) {
    if (netsByName.has(net.name)) {
      // Merge into existing net
      const existingNet = netsByName.get(net.name)!;
      
      // Combine all connections from all nodes
      const allConnections: HybridConnection[] = [];
      for (const node of existingNet.nodes) {
        allConnections.push(...node.connections);
      }
      for (const node of net.nodes) {
        allConnections.push(...node.connections);
      }
      
      // Remove duplicate connections (same component + pin)
      const uniqueConnections: HybridConnection[] = [];
      const seen = new Set<string>();
      for (const conn of allConnections) {
        const key = conn.type === 'component_pin' 
          ? `${conn.component}:${conn.pin}`
          : conn.type === 'via'
          ? `via:${conn.ref}`
          : conn.type === 'pad'
          ? `pad:${conn.ref}`
          : `${conn.type}:${conn.ref || ''}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConnections.push(conn);
        }
      }
      
      // Update the existing net's first node with combined connections
      existingNet.nodes[0].connections = uniqueConnections;
      
      // Merge test points (take the first one found)
      if (!existingNet.nodes[0].test_point_id && net.nodes[0].test_point_id) {
        existingNet.nodes[0].test_point_id = net.nodes[0].test_point_id;
      }
    } else {
      // Add new net
      netsByName.set(net.name, net);
    }
  }
  
  // Convert back to array
  const mergedNets = Array.from(netsByName.values());
  
  // Log if any nets were merged
  if (mergedNets.length < hybridNets.length) {
    console.log(`[HybridNetlist] Merged ${hybridNets.length - mergedNets.length} duplicate net(s) with same name`);
  }
  
  // Sort nets: GND first, then power nets, then signal nets
  mergedNets.sort((a, b) => {
    if (a.name === 'GND') return -1;
    if (b.name === 'GND') return 1;
    if (a.type === 'power_ground' && b.type !== 'power_ground') return -1;
    if (b.type === 'power_ground' && a.type !== 'power_ground') return 1;
    if (a.type === 'power' && b.type === 'signal') return -1;
    if (b.type === 'power' && a.type === 'signal') return 1;
    return a.name.localeCompare(b.name);
  });
  
  console.log(`[HybridNetlist] Generated ${mergedNets.length} nets (after merging duplicates)`);
  
  // Build hybrid components with node_id references
  const hybridComponents: HybridComponent[] = [];
  const missingValueComponents: string[] = [];
  
  for (const comp of components) {
    const designator = comp.designator?.trim() || (comp as any).abbreviation?.trim();
    if (!designator) continue;
    
    const pinCount = comp.pinCount || 0;
    const pinData = (comp as any).pinData as Array<{ name: string; type?: string }> | undefined;
    const pinNames = (comp as any).pinNames as string[] | undefined;
    const pinConnections = comp.pinConnections || [];
    
    const hybridPins: HybridPin[] = [];
    
    for (let i = 0; i < pinCount; i++) {
      const pinNumber = String(i + 1);
      
      // Get pin name
      let pinName = pinNumber;
      if (pinData && i < pinData.length && pinData[i]?.name?.trim()) {
        pinName = pinData[i].name.trim();
      } else if (pinNames && i < pinNames.length && pinNames[i]?.trim()) {
        pinName = pinNames[i].trim();
      }
      
      // Get pin type
      const pinType = pinData?.[i]?.type || inferPinType(pinName);
      
      // Find node_id for this pin
      let nodeId: string | undefined;
      const pinConnectionStr = pinConnections[i];
      if (pinConnectionStr) {
        const internalNodeId = parseInt(pinConnectionStr.trim(), 10);
        if (!isNaN(internalNodeId)) {
          nodeId = nodeIdToSemanticId.get(internalNodeId);
          
          // If not found directly, search through all nets (use mergedNets)
          if (!nodeId) {
            for (const net of mergedNets) {
              for (const node of net.nodes) {
                if (node.connections.some(c => 
                  c.type === 'component_pin' && 
                  c.component === designator && 
                  c.pin === pinNumber
                )) {
                  nodeId = node.id;
                  break;
                }
              }
              if (nodeId) break;
            }
          }
        }
      }
      
      // Check for test point
      let testPoint: string | undefined;
      if (pinConnectionStr) {
        const internalNodeId = parseInt(pinConnectionStr.trim(), 10);
        if (!isNaN(internalNodeId)) {
          testPoint = nodeIdToTestPoint.get(internalNodeId);
        }
      }
      
      hybridPins.push({
        number: pinNumber,
        name: pinName,
        type: pinType,
        node_id: nodeId,
        test_point: testPoint
      });
    }
    
    const hybridComp: Partial<HybridComponent> & { designator: string; package: string } = {
      designator,
      package: (comp as any).packageType?.trim() || (comp as any).package?.trim() || ''
    };
    
    // Add part number if available
    const partNumber = (comp as any).partNumber?.trim();
    if (partNumber) {
      hybridComp.part_number = partNumber;
    }
    
    // Add value if available
    const value = getComponentValueString(comp);
    if (value) {
      hybridComp.value = value;
    } else {
      // Track components that should have values but don't
      if (comp.componentType === 'Resistor' || 
          comp.componentType === 'Capacitor' ||
          comp.componentType === 'Electrolytic Capacitor' ||
          comp.componentType === 'Film Capacitor' ||
          comp.componentType === 'Inductor' ||
          comp.componentType === 'Battery') {
        missingValueComponents.push(designator);
      }
    }
    
    // Add tolerance if available (for resistors/capacitors)
    // Ensure proper UTF-8 encoding by normalizing the tolerance string
    const tolerance = (comp as any).tolerance?.trim();
    if (tolerance) {
      // Fix any double-encoded UTF-8 issues (Â± → ±)
      const normalizedTolerance = tolerance.replace(/Â±/g, '±');
      hybridComp.tolerance = normalizedTolerance;
    }
    
    // Add description if available
    const description = (comp as any).description?.trim() || (comp as any).partName?.trim();
    if (description) {
      hybridComp.description = description;
    }
    
    hybridComp.pins = hybridPins;
    hybridComponents.push(hybridComp as HybridComponent);
  }
  
  // Sort components by designator
  hybridComponents.sort((a, b) => {
    // Extract prefix and number for natural sorting
    const aMatch = a.designator.match(/^([A-Za-z]+)(\d+)$/);
    const bMatch = b.designator.match(/^([A-Za-z]+)(\d+)$/);
    
    if (aMatch && bMatch) {
      const prefixCompare = aMatch[1].localeCompare(bMatch[1]);
      if (prefixCompare !== 0) return prefixCompare;
      return parseInt(aMatch[2]) - parseInt(bMatch[2]);
    }
    
    return a.designator.localeCompare(b.designator);
  });
  
  console.log(`[HybridNetlist] Generated ${hybridComponents.length} components`);
  
  // Update test point node_ids to use semantic IDs and remove orphaned test points
  const validTestPoints: HybridTestPoint[] = [];
  for (const tp of testPoints) {
    // Find which net this test point belongs to
    let found = false;
    for (const net of mergedNets) {
      if (net.nodes.some(n => n.test_point_id === tp.id)) {
        tp.node_id = net.nodes[0].id;
        validTestPoints.push(tp);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`[HybridNetlist] Removed orphaned test point ${tp.id} (not connected to any net)`);
    }
  }
  
  // Log warning if components are missing values
  if (missingValueComponents.length > 0) {
    console.warn(
      `[HybridNetlist] Warning: ${missingValueComponents.length} component(s) missing values: ${missingValueComponents.join(', ')}`
    );
  }
  
  // Build final hybrid netlist structure
  const hybridNetlist: HybridNetlist = {
    design_info: {
      name: projectName,
      version: '1.0',
      date: new Date().toISOString().split('T')[0]
    },
    components: hybridComponents,
    nets: mergedNets,
    test_points: validTestPoints
  };
  
  // Return formatted JSON with metadata about missing values
  const result = JSON.stringify(hybridNetlist, null, 2);
  
  // Store warning in a way that can be retrieved by the caller
  if (missingValueComponents.length > 0) {
    (generateHybridNetlist as any).lastWarnings = {
      missingValues: missingValueComponents
    };
  } else {
    (generateHybridNetlist as any).lastWarnings = null;
  }
  
  return result;
}
