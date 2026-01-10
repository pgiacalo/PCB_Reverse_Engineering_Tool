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
// KiCad Netlist Export Module
// ============================================================================
// Converts PCBTracer's hybrid JSON netlist to KiCad-compatible formats

import type { HybridNetlist } from './hybridNetlist';

/**
 * KiCad netlist format options
 */
export type KiCadNetlistFormat = 'protel' | 's-expression';

/**
 * Generate KiCad netlist from hybrid netlist
 * 
 * @param hybridNetlist - The hybrid netlist to convert
 * @param format - Output format ('protel' or 's-expression')
 * @returns KiCad-formatted netlist string
 */
export function generateKiCadNetlist(
  hybridNetlist: HybridNetlist,
  format: KiCadNetlistFormat = 'protel'
): string {
  if (format === 'protel') {
    return generateProtelNetlist(hybridNetlist);
  } else {
    return generateSExpressionNetlist(hybridNetlist);
  }
}

/**
 * Generate KiCad Protel format netlist
 * This is the classic KiCad netlist format used by older tools
 */
function generateProtelNetlist(netlist: HybridNetlist): string {
  const lines: string[] = [];
  
  // Header
  lines.push('(');
  lines.push('  (export (version D)');
  lines.push(`    (design`);
  lines.push(`      (source "PCBTracer")`);
  lines.push(`      (date "${new Date().toISOString()}")`);
  lines.push(`      (tool "PCBTracer v${netlist.metadata.version}")`);
  lines.push(`    )`);
  lines.push('  )');
  lines.push('');
  
  // Components section
  lines.push('  (components');
  for (const comp of netlist.components) {
    lines.push(`    (comp (ref ${comp.designator})`);
    lines.push(`      (value ${escapeValue(comp.value || comp.type)})`);
    
    if (comp.footprint) {
      lines.push(`      (footprint ${comp.footprint})`);
    }
    
    if (comp.datasheet) {
      lines.push(`      (datasheet ${comp.datasheet})`);
    }
    
    if (comp.description) {
      lines.push(`      (description ${escapeValue(comp.description)})`);
    }
    
    // Add manufacturer and part number if available
    if (comp.manufacturer) {
      lines.push(`      (property "Manufacturer" "${comp.manufacturer}")`);
    }
    if (comp.partNumber) {
      lines.push(`      (property "PartNumber" "${comp.partNumber}")`);
    }
    
    lines.push(`    )`);
  }
  lines.push('  )');
  lines.push('');
  
  // Nets section
  lines.push('  (nets');
  
  // Sort nets: GND first, power nets, then signal nets
  const sortedNets = [...netlist.nets].sort((a, b) => {
    if (a.name === 'GND') return -1;
    if (b.name === 'GND') return 1;
    if (a.type === 'power' && b.type !== 'power') return -1;
    if (b.type === 'power' && a.type !== 'power') return 1;
    return a.name.localeCompare(b.name);
  });
  
  sortedNets.forEach((net, index) => {
    const netCode = index + 1;
    lines.push(`    (net (code ${netCode}) (name ${escapeNetName(net.name)})`);
    
    // Add all component pin connections
    for (const conn of net.connections) {
      if (conn.type === 'component_pin') {
        lines.push(`      (node (ref ${conn.component_ref}) (pin ${conn.pin_number}))`);
      }
    }
    
    lines.push(`    )`);
  });
  
  lines.push('  )');
  lines.push(')');
  
  return lines.join('\n');
}

/**
 * Generate KiCad S-Expression format netlist
 * This is the modern KiCad netlist format (v6+)
 */
function generateSExpressionNetlist(netlist: HybridNetlist): string {
  const lines: string[] = [];
  
  // Header
  lines.push('(export (version "E")');
  lines.push('  (design');
  lines.push('    (source "PCBTracer")');
  lines.push(`    (date "${new Date().toISOString()}")`);
  lines.push(`    (tool "PCBTracer v${netlist.metadata.version}")`);
  lines.push(`    (sheet (number "1") (name "/") (tstamps "/"))`);
  lines.push('  )');
  lines.push('');
  
  // Components section
  lines.push('  (components');
  for (const comp of netlist.components) {
    lines.push(`    (comp (ref "${comp.designator}")`);
    lines.push(`      (value "${escapeValue(comp.value || comp.type)}")`);
    
    if (comp.footprint) {
      lines.push(`      (footprint "${comp.footprint}")`);
    }
    
    if (comp.datasheet) {
      lines.push(`      (datasheet "${comp.datasheet}")`);
    }
    
    if (comp.description) {
      lines.push(`      (description "${escapeValue(comp.description)}")`);
    }
    
    // Properties
    if (comp.manufacturer || comp.partNumber) {
      lines.push('      (properties');
      if (comp.manufacturer) {
        lines.push(`        (property (name "Manufacturer") (value "${comp.manufacturer}"))`);
      }
      if (comp.partNumber) {
        lines.push(`        (property (name "PartNumber") (value "${comp.partNumber}"))`);
      }
      lines.push('      )');
    }
    
    // Pins
    lines.push('      (pins');
    for (const pin of comp.pins) {
      lines.push(`        (pin (num "${pin.number}") (name "${pin.name || ''}") (type "${pin.type || 'passive'}"))`);
    }
    lines.push('      )');
    
    lines.push('    )');
  }
  lines.push('  )');
  lines.push('');
  
  // Nets section
  lines.push('  (nets');
  
  // Sort nets: GND first, power nets, then signal nets
  const sortedNets = [...netlist.nets].sort((a, b) => {
    if (a.name === 'GND') return -1;
    if (b.name === 'GND') return 1;
    if (a.type === 'power' && b.type !== 'power') return -1;
    if (b.type === 'power' && a.type !== 'power') return 1;
    return a.name.localeCompare(b.name);
  });
  
  sortedNets.forEach((net, index) => {
    const netCode = index + 1;
    lines.push(`    (net (code "${netCode}") (name "${escapeNetName(net.name)}")`);
    
    // Add all component pin connections
    for (const conn of net.connections) {
      if (conn.type === 'component_pin') {
        lines.push(`      (node (ref "${conn.component_ref}") (pin "${conn.pin_number}") (pinfunction "${conn.pin_name || ''}"))`);
      }
    }
    
    lines.push('    )');
  });
  
  lines.push('  )');
  lines.push(')');
  
  return lines.join('\n');
}

/**
 * Escape special characters in component values
 */
function escapeValue(value: string): string {
  // Remove or escape characters that might cause issues in netlist
  return value
    .replace(/"/g, '\\"')  // Escape quotes
    .replace(/\n/g, ' ')   // Replace newlines with spaces
    .replace(/\r/g, '')    // Remove carriage returns
    .trim();
}

/**
 * Escape and format net names for KiCad
 */
function escapeNetName(name: string): string {
  // KiCad net names should not have quotes unless they contain spaces or special chars
  if (/[\s()]/.test(name)) {
    return `"${name.replace(/"/g, '\\"')}"`;
  }
  return name;
}

/**
 * Validate hybrid netlist before export
 * Returns array of validation warnings/errors
 */
export function validateNetlistForKiCad(netlist: HybridNetlist): string[] {
  const warnings: string[] = [];
  
  // Check for components without designators
  const componentsWithoutDesignators = netlist.components.filter(c => !c.designator || c.designator.trim() === '');
  if (componentsWithoutDesignators.length > 0) {
    warnings.push(`${componentsWithoutDesignators.length} component(s) missing designators`);
  }
  
  // Check for duplicate designators
  const designators = netlist.components.map(c => c.designator).filter(d => d);
  const duplicates = designators.filter((d, i) => designators.indexOf(d) !== i);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate designators found: ${[...new Set(duplicates)].join(', ')}`);
  }
  
  // Check for unconnected component pins
  const allConnectedPins = new Set<string>();
  for (const net of netlist.nets) {
    for (const conn of net.connections) {
      if (conn.type === 'component_pin') {
        allConnectedPins.add(`${conn.component_ref}:${conn.pin_number}`);
      }
    }
  }
  
  let totalPins = 0;
  for (const comp of netlist.components) {
    totalPins += comp.pins.length;
  }
  
  const connectedPinCount = allConnectedPins.size;
  if (connectedPinCount < totalPins) {
    warnings.push(`${totalPins - connectedPinCount} unconnected pin(s) detected`);
  }
  
  // Check for nets with no connections
  const emptyNets = netlist.nets.filter(net => 
    net.connections.filter(c => c.type === 'component_pin').length === 0
  );
  if (emptyNets.length > 0) {
    warnings.push(`${emptyNets.length} net(s) with no component connections: ${emptyNets.map(n => n.name).join(', ')}`);
  }
  
  return warnings;
}
