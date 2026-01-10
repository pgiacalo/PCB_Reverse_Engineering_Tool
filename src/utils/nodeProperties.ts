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
// Node Properties - Optional Fields and Auto-Inference
// ============================================================================
// Phase 1 Implementation:
// - Define NodeOptionalFields interface
// - Auto-inference based on net name and type
// - Merge with user overrides
// ============================================================================

/**
 * Optional fields that can be attached to nodes for troubleshooting and documentation
 */
export interface NodeOptionalFields {
  // Basic metadata
  notes?: string;                    // User notes about this node
  criticality?: 'low' | 'medium' | 'high';  // Importance for troubleshooting
  signal_type?: 'digital' | 'analog' | 'power' | 'ground';  // Signal classification
  function?: string;                 // Descriptive function name (e.g., "oscillator_feedback")
  
  // Test point association
  test_point_id?: string;            // Link to test point if accessible
  
  // Related nodes (e.g., differential pairs)
  related_nodes?: string[];          // IDs of related nodes
  
  // Signal characteristics (optional, typically for signal nodes)
  impedance?: {
    nominal: number;
    tolerance: number;
    unit: string;  // "Ohm"
  };
  frequency_range?: {
    min: number;
    max: number;
    unit: string;  // "Hz", "kHz", "MHz"
  };
  
  // Standards compliance
  standards?: string[];              // e.g., ["USB_2.0", "I2C"]
}

/**
 * Expected voltage range for a node
 */
export interface ExpectedVoltage {
  min: number;
  max: number;
  nominal?: number;
}

/**
 * Get default node properties based on net name and type
 * This provides reasonable defaults that users can override
 */
export function inferNodeProperties(
  netName: string,
  netType?: 'power' | 'power_ground' | 'signal'
): NodeOptionalFields {
  // Check for ground nets
  if (netName === 'GND' || 
      netName.toUpperCase().includes('GROUND') ||
      netType === 'power_ground') {
    return {
      signal_type: 'ground',
      criticality: 'high'
    };
  }
  
  // Check for power nets (start with + or -)
  if (netName.startsWith('+') || netName.startsWith('-') ||
      netType === 'power') {
    return {
      signal_type: 'power',
      criticality: 'high'
    };
  }
  
  // Default for signal nets
  return {
    signal_type: 'analog',  // Default to analog, can be refined
    criticality: 'medium'
  };
}

/**
 * Infer expected voltage range based on net name
 */
export function inferExpectedVoltage(
  netName: string,
  netType?: 'power' | 'power_ground' | 'signal'
): ExpectedVoltage | undefined {
  // Ground nets: expect ~0V
  if (netName === 'GND' || 
      netName.toUpperCase().includes('GROUND') ||
      netType === 'power_ground') {
    return {
      min: -0.1,
      max: 0.1,
      nominal: 0.0
    };
  }
  
  // Power nets: parse voltage from name
  if (netName.startsWith('+') || netName.startsWith('-') ||
      netType === 'power') {
    // Try to extract voltage value (e.g., "+5V", "-12V", "+3.3V")
    const voltageMatch = netName.match(/([+-]?[\d.]+)\s*V/i);
    if (voltageMatch) {
      const nominal = parseFloat(voltageMatch[1]);
      // Standard tolerance of +/-5%
      const tolerance = Math.abs(nominal) * 0.05;
      return {
        min: nominal - tolerance,
        max: nominal + tolerance,
        nominal
      };
    }
    
    // Common power rail names without explicit voltage
    const commonRails: Record<string, ExpectedVoltage> = {
      'VCC': { min: 4.75, max: 5.25, nominal: 5.0 },
      'VDD': { min: 3.15, max: 3.45, nominal: 3.3 },
      'AVCC': { min: 4.75, max: 5.25, nominal: 5.0 },
      'DVCC': { min: 3.15, max: 3.45, nominal: 3.3 }
    };
    
    const upperName = netName.toUpperCase();
    if (commonRails[upperName]) {
      return commonRails[upperName];
    }
  }
  
  // Signal nets: wide range based on likely power supply
  return {
    min: 0.0,
    max: 5.0  // Assume 5V system by default
  };
}

/**
 * Merge auto-inferred properties with user overrides
 * User overrides take precedence
 */
export function mergeNodeProperties(
  inferred: NodeOptionalFields,
  userOverrides?: NodeOptionalFields
): NodeOptionalFields {
  if (!userOverrides) {
    return inferred;
  }
  
  // Merge, with user overrides taking precedence
  return {
    ...inferred,
    ...userOverrides
  };
}

/**
 * Serialize node properties map for storage in project.json
 */
export function serializeNodeProperties(
  properties: Map<number, NodeOptionalFields>
): Record<string, NodeOptionalFields> {
  const result: Record<string, NodeOptionalFields> = {};
  for (const [nodeId, props] of properties) {
    result[String(nodeId)] = props;
  }
  return result;
}

/**
 * Deserialize node properties from project.json
 */
export function deserializeNodeProperties(
  data: Record<string, NodeOptionalFields> | undefined
): Map<number, NodeOptionalFields> {
  const result = new Map<number, NodeOptionalFields>();
  if (!data) {
    return result;
  }
  
  for (const [nodeIdStr, props] of Object.entries(data)) {
    const nodeId = parseInt(nodeIdStr, 10);
    if (!isNaN(nodeId)) {
      result.set(nodeId, props);
    }
  }
  return result;
}
