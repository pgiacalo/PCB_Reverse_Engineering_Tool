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

/**
 * Troubleshooting Utility Module
 * 
 * Provides functions for AI-powered troubleshooting analysis including:
 * - Identical signal path detection
 * - Measurement data extraction and comparison
 * - Prompt building for AI analysis
 * - Analysis orchestration
 */

import type { PCBComponent, DrawingStroke } from '../types';
import type { ProjectMetadata, ProjectNote } from '../components/ProjectNotesDialog/ProjectNotesDialog';
import type { AIService, AITextAnalysisRequest } from './aiServices/types';
import { getTroubleshootingPrompt } from './aiPrompts';

/**
 * Identical signal path group
 */
export interface IdenticalPathGroup {
  paths: SignalPath[];
  description: string; // e.g., "Left/Right stereo channels"
}

/**
 * Signal path representation
 */
export interface SignalPath {
  components: Array<{
    designator: string;
    componentType: string;
    partNumber?: string;
    value?: string;
  }>;
  pathId: string; // Unique identifier for this path
}

/**
 * Measurement data extracted from Project Notes
 */
export interface MeasurementData {
  componentDesignator?: string;
  testPoint?: string;
  measurementType: string; // e.g., "voltage", "current", "resistance"
  value: number;
  unit: string;
  note: ProjectNote;
}

/**
 * Path comparison result
 */
export interface PathComparison {
  pathGroup: IdenticalPathGroup;
  measurements: Map<string, MeasurementData[]>; // pathId -> measurements
  discrepancies: Array<{
    path1: string;
    path2: string;
    component: string;
    measurement1?: MeasurementData;
    measurement2?: MeasurementData;
    difference: string;
  }>;
}

/**
 * PCB data structure for troubleshooting
 */
export interface TroubleshootingPcbData {
  components: PCBComponent[];
  drawingStrokes: DrawingStroke[];
  testPoints: Array<{
    id: string;
    x: number;
    y: number;
    layer: 'top' | 'bottom';
    nodeId?: number;
    notes?: string | null;
    testPointType?: 'power' | 'ground' | 'signal' | 'unknown';
  }>;
  powerNodes?: Array<{ id: string; name: string; voltage?: string }>;
  groundNodes?: Array<{ id: string; name: string }>;
}

/**
 * Detect identical signal paths in PCB data
 * 
 * Identifies duplicate signal paths (e.g., stereo channels, dual amplifiers)
 * by comparing component types, values, and connectivity patterns.
 */
export function detectIdenticalSignalPaths(
  components: PCBComponent[],
  drawingStrokes: DrawingStroke[]
): IdenticalPathGroup[] {
  const pathGroups: IdenticalPathGroup[] = [];
  
  // Group components by type and value to find potential duplicate paths
  const componentGroups = new Map<string, PCBComponent[]>();
  
  for (const comp of components) {
    // Skip power, ground, and common components
    if (comp.componentType === 'Battery' || 
        comp.componentType === 'PowerSupply' ||
        comp.designator.startsWith('GND') ||
        comp.designator.startsWith('VCC') ||
        comp.designator.startsWith('VDD')) {
      continue;
    }
    
    // Create a key based on component type and value
    const value = getComponentValue(comp);
    const key = `${comp.componentType}:${value || 'unknown'}`;
    
    if (!componentGroups.has(key)) {
      componentGroups.set(key, []);
    }
    componentGroups.get(key)!.push(comp);
  }
  
  // Find groups with 2 or more identical components (potential duplicate paths)
  for (const [key, comps] of componentGroups.entries()) {
    if (comps.length >= 2) {
      // Check if these components form duplicate signal paths
      // This is a simplified detection - in practice, you'd analyze connectivity
      const paths: SignalPath[] = comps.map((comp, index) => ({
        components: [{
          designator: comp.designator,
          componentType: comp.componentType,
          partNumber: comp.partNumber,
          value: getComponentValue(comp),
        }],
        pathId: `path-${index}`,
      }));
      
      if (paths.length >= 2) {
        pathGroups.push({
          paths,
          description: `${paths.length} identical ${comps[0].componentType} paths detected`,
        });
      }
    }
  }
  
  // TODO: More sophisticated path detection by analyzing connectivity
  // This would trace signal paths from input to output and compare them
  
  return pathGroups;
}

/**
 * Get component value as string (for comparison)
 */
function getComponentValue(comp: PCBComponent): string | undefined {
  // Try to get value from common properties
  if ('resistance' in comp && (comp as any).resistance) {
    return `${(comp as any).resistance}${(comp as any).resistanceUnit || ''}`;
  }
  if ('capacitance' in comp && (comp as any).capacitance) {
    return `${(comp as any).capacitance}${(comp as any).capacitanceUnit || ''}`;
  }
  if ('inductance' in comp && (comp as any).inductance) {
    return `${(comp as any).inductance}${(comp as any).inductanceUnit || ''}`;
  }
  if (comp.partNumber) {
    return comp.partNumber;
  }
  return undefined;
}

/**
 * Extract measurement data from Project Notes
 */
export function extractMeasurementData(
  selectedMeasurementNotes: ProjectNote[]
): MeasurementData[] {
  const measurements: MeasurementData[] = [];
  
  for (const note of selectedMeasurementNotes) {
    // Try to parse measurement from note value
    // Format examples:
    // "R1 voltage: 5.2V"
    // "U1 pin 3: 3.3V"
    // "TP5: 12.5mA"
    // "Left channel output: 5.2V"
    
    const value = note.value.trim();
    const match = value.match(/(?:([A-Z]\d+|TP\d+|Left|Right|Channel\s+\d+)[\s:]+)?([\d.]+)\s*([A-Za-zµΩ]+)/i);
    
    if (match) {
      const [, designator, numValue, unit] = match;
      const numericValue = parseFloat(numValue);
      
      if (!isNaN(numericValue)) {
        // Determine measurement type from unit
        let measurementType = 'unknown';
        const unitLower = unit.toLowerCase();
        if (unitLower.includes('v') || unitLower === 'mv' || unitLower === 'kv') {
          measurementType = 'voltage';
        } else if (unitLower.includes('a') || unitLower === 'ma' || unitLower === 'µa' || unitLower === 'ua') {
          measurementType = 'current';
        } else if (unitLower.includes('Ω') || unitLower === 'ohm' || unitLower === 'kohm' || unitLower === 'mohm') {
          measurementType = 'resistance';
        }
        
        measurements.push({
          componentDesignator: designator || undefined,
          measurementType,
          value: numericValue,
          unit: unit,
          note,
        });
      }
    }
  }
  
  return measurements;
}

/**
 * Compare measurements between identical signal paths
 */
export function compareIdenticalPaths(
  pathGroups: IdenticalPathGroup[],
  measurementData: MeasurementData[]
): PathComparison[] {
  const comparisons: PathComparison[] = [];
  
  for (const pathGroup of pathGroups) {
    const measurements = new Map<string, MeasurementData[]>();
    const discrepancies: PathComparison['discrepancies'] = [];
    
    // Group measurements by path
    for (const path of pathGroup.paths) {
      const pathMeasurements: MeasurementData[] = [];
      
      for (const measurement of measurementData) {
        // Match measurement to path by component designator
        if (measurement.componentDesignator) {
          const pathComponent = path.components.find(
            c => c.designator === measurement.componentDesignator
          );
          if (pathComponent) {
            pathMeasurements.push(measurement);
          }
        }
      }
      
      measurements.set(path.pathId, pathMeasurements);
    }
    
    // Compare measurements between paths
    if (pathGroup.paths.length >= 2) {
      for (let i = 0; i < pathGroup.paths.length; i++) {
        for (let j = i + 1; j < pathGroup.paths.length; j++) {
          const path1 = pathGroup.paths[i];
          const path2 = pathGroup.paths[j];
          const meas1 = measurements.get(path1.pathId) || [];
          const meas2 = measurements.get(path2.pathId) || [];
          
          // Find corresponding measurements
          for (const m1 of meas1) {
            for (const m2 of meas2) {
              if (m1.measurementType === m2.measurementType && 
                  m1.componentDesignator === m2.componentDesignator) {
                const diff = Math.abs(m1.value - m2.value);
                const percentDiff = (diff / Math.max(m1.value, m2.value)) * 100;
                
                if (percentDiff > 5) { // 5% threshold for discrepancy
                  discrepancies.push({
                    path1: path1.pathId,
                    path2: path2.pathId,
                    component: m1.componentDesignator || 'unknown',
                    measurement1: m1,
                    measurement2: m2,
                    difference: `${diff.toFixed(2)}${m1.unit} (${percentDiff.toFixed(1)}% difference)`,
                  });
                }
              }
            }
          }
        }
      }
    }
    
    if (discrepancies.length > 0 || measurements.size > 0) {
      comparisons.push({
        pathGroup,
        measurements,
        discrepancies,
      });
    }
  }
  
  return comparisons;
}

/**
 * Build troubleshooting prompt for AI analysis
 */
export function buildTroubleshootingPrompt(
  metadata: ProjectMetadata,
  selectedSymptoms: ProjectNote[],
  includePcbData: boolean,
  pcbData?: TroubleshootingPcbData,
  selectedMeasurements?: ProjectNote[],
  pathComparisons?: PathComparison[]
): string {
  const basePrompt = getTroubleshootingPrompt();
  if (!basePrompt) {
    throw new Error('Troubleshooting prompt template not found');
  }
  
  // Build product information section
  const productInfo = `
Product Information:
- Product Name: ${metadata.productName || 'Not specified'}
- Model Number: ${metadata.modelNumber || 'Not specified'}
- Manufacturer: ${metadata.manufacturer || 'Not specified'}
- Date Manufactured: ${metadata.dateManufactured || 'Not specified'}
`.trim();
  
  // Build symptoms section
  const symptomsList = selectedSymptoms.map((note, index) => 
    `${index + 1}. ${note.name}: ${note.value}`
  ).join('\n');
  
  const symptomsSection = `
Reported Symptoms:
${symptomsList}
`.trim();
  
  // Build PCB data section (if included)
  let pcbDataSection = '';
  if (includePcbData && pcbData) {
    const componentList = pcbData.components.map(comp => {
      const value = getComponentValue(comp);
      return `  - ${comp.designator}: ${comp.componentType}${value ? ` (${value})` : ''}${comp.partNumber ? ` [${comp.partNumber}]` : ''}`;
    }).join('\n');
    
    pcbDataSection = `
PCB Component Information:
Components:
${componentList}
`.trim();
    
    if (pcbData.powerNodes && pcbData.powerNodes.length > 0) {
      const powerList = pcbData.powerNodes.map(p => `  - ${p.name}${p.voltage ? ` (${p.voltage})` : ''}`).join('\n');
      pcbDataSection += `\n\nPower Nodes:\n${powerList}`;
    }
    
    if (pcbData.groundNodes && pcbData.groundNodes.length > 0) {
      const groundList = pcbData.groundNodes.map(g => `  - ${g.name}`).join('\n');
      pcbDataSection += `\n\nGround Nodes:\n${groundList}`;
    }
    
    // Add test point data
    if (pcbData.testPoints && pcbData.testPoints.length > 0) {
      const testPointsWithNodeId = pcbData.testPoints.filter(tp => tp.nodeId !== undefined);
      const testPointsWithoutNodeId = pcbData.testPoints.filter(tp => tp.nodeId === undefined);
      
      if (testPointsWithNodeId.length > 0) {
        const testPointList = testPointsWithNodeId.map(tp => {
          let info = `  - Test Point ${tp.id} (Node ID: ${tp.nodeId}, Layer: ${tp.layer}`;
          if (tp.testPointType) {
            info += `, Type: ${tp.testPointType}`;
          }
          if (tp.notes) {
            info += `, Notes: ${tp.notes}`;
          }
          info += ')';
          return info;
        }).join('\n');
        pcbDataSection += `\n\nTest Points (with Node IDs - may have measurement data):\n${testPointList}`;
      }
      
      if (testPointsWithoutNodeId.length > 0) {
        const testPointList = testPointsWithoutNodeId.map(tp => {
          let info = `  - Test Point ${tp.id} (Layer: ${tp.layer}`;
          if (tp.testPointType) {
            info += `, Type: ${tp.testPointType}`;
          }
          if (tp.notes) {
            info += `, Notes: ${tp.notes}`;
          }
          info += ')';
          return info;
        }).join('\n');
        pcbDataSection += `\n\nTest Points (without Node IDs - may be symptoms or general notes):\n${testPointList}`;
      }
    }
  }
  
  // Build measurement data section (if provided)
  let measurementSection = '';
  if (selectedMeasurements && selectedMeasurements.length > 0) {
    const measurementList = selectedMeasurements.map((note, index) => 
      `${index + 1}. ${note.name}: ${note.value}`
    ).join('\n');
    
    measurementSection = `
Measurement Data:
${measurementList}
`.trim();
  }
  
  // Build path comparison section (if available)
  let pathComparisonSection = '';
  if (pathComparisons && pathComparisons.length > 0) {
    const comparisonTexts = pathComparisons.map(comp => {
      let text = `${comp.pathGroup.description}:\n`;
      
      if (comp.discrepancies.length > 0) {
        text += 'Discrepancies detected:\n';
        for (const disc of comp.discrepancies) {
          text += `  - ${disc.component}: ${disc.measurement1?.value}${disc.measurement1?.unit} vs ${disc.measurement2?.value}${disc.measurement2?.unit} (${disc.difference})\n`;
        }
      }
      
      return text;
    }).join('\n');
    
    pathComparisonSection = `
Identical Path Comparison Analysis:
${comparisonTexts}
`.trim();
  }
  
  // Replace all placeholders in the prompt
  let fullPrompt = basePrompt
    .replace('{productName}', metadata.productName || 'Not specified')
    .replace('{modelNumber}', metadata.modelNumber || 'Not specified')
    .replace('{manufacturer}', metadata.manufacturer || 'Not specified')
    .replace('{dateManufactured}', metadata.dateManufactured || 'Not specified')
    .replace('{formatted symptoms list}', symptomsList);
  
  // Replace optional sections
  if (includePcbData && pcbData) {
    fullPrompt = fullPrompt.replace('{Optional: PCB Component Information section if includePcbData is true}\n{Includes component list, connectivity, and identified identical signal paths if detected}', pcbDataSection);
  } else {
    fullPrompt = fullPrompt.replace('{Optional: PCB Component Information section if includePcbData is true}\n{Includes component list, connectivity, and identified identical signal paths if detected}', '');
  }
  
  if (measurementSection) {
    fullPrompt = fullPrompt.replace('{Optional: Measurement Data section if measurements provided}\n{Formatted measurement data with component/test point associations}', measurementSection);
  } else {
    fullPrompt = fullPrompt.replace('{Optional: Measurement Data section if measurements provided}\n{Formatted measurement data with component/test point associations}', '');
  }
  
  if (pathComparisonSection) {
    fullPrompt = fullPrompt.replace('{Optional: Identical Path Comparison section if PCB data and measurements both included}\n{Comparison analysis showing differences between identical signal paths}\n{Example: "Left channel voltage: 5.2V, Right channel voltage: 0.3V (discrepancy detected)"}', pathComparisonSection);
  } else {
    fullPrompt = fullPrompt.replace('{Optional: Identical Path Comparison section if PCB data and measurements both included}\n{Comparison analysis showing differences between identical signal paths}\n{Example: "Left channel voltage: 5.2V, Right channel voltage: 0.3V (discrepancy detected)"}', '');
  }
  
  // Replace conditional sections in output format
  if (includePcbData && pcbData) {
    fullPrompt = fullPrompt.replace('{Only if PCB data included}', '');
  } else {
    fullPrompt = fullPrompt.replace('{Only if PCB data included}\n', '');
  }
  
  if (pathComparisons && pathComparisons.length > 0) {
    fullPrompt = fullPrompt.replace('{Only if identical signal paths detected and measurements provided}', '');
  } else {
    fullPrompt = fullPrompt.replace('{Only if identical signal paths detected and measurements provided}\n', '');
  }
  
  return fullPrompt;
}

/**
 * Extract test points from drawing strokes
 */
export function extractTestPoints(drawingStrokes: DrawingStroke[]): TroubleshootingPcbData['testPoints'] {
  return drawingStrokes
    .filter(stroke => stroke.type === 'testPoint')
    .map(stroke => ({
      id: stroke.id,
      x: stroke.points[0]?.x ?? 0,
      y: stroke.points[0]?.y ?? 0,
      layer: stroke.layer,
      nodeId: stroke.points[0]?.id,
      notes: stroke.notes,
      testPointType: stroke.testPointType,
    }));
}

/**
 * Build troubleshooting prompt (for preview/edit)
 */
export function buildTroubleshootingPromptForPreview(
  metadata: ProjectMetadata,
  selectedSymptoms: ProjectNote[],
  includePcbData: boolean,
  pcbData: TroubleshootingPcbData | undefined,
  selectedMeasurements: ProjectNote[],
  pathComparisons?: PathComparison[]
): string {
  return buildTroubleshootingPrompt(
    metadata,
    selectedSymptoms,
    includePcbData,
    pcbData,
    selectedMeasurements,
    pathComparisons
  );
}

/**
 * Run troubleshooting analysis
 */
export async function runTroubleshootingAnalysis(
  metadata: ProjectMetadata,
  selectedSymptoms: ProjectNote[],
  includePcbData: boolean,
  pcbData: TroubleshootingPcbData | undefined,
  selectedMeasurements: ProjectNote[],
  aiService: AIService
): Promise<{ success: boolean; results?: string; error?: string }> {
  try {
    // Detect identical signal paths if PCB data included
    let pathGroups: IdenticalPathGroup[] = [];
    let pathComparisons: PathComparison[] = [];
    
    if (includePcbData && pcbData) {
      pathGroups = detectIdenticalSignalPaths(pcbData.components, pcbData.drawingStrokes);
      
      // Extract and compare measurements if provided
      if (selectedMeasurements.length > 0) {
        const measurementData = extractMeasurementData(selectedMeasurements);
        pathComparisons = compareIdenticalPaths(pathGroups, measurementData);
      }
    }
    
    // Build prompt
    const prompt = buildTroubleshootingPrompt(
      metadata,
      selectedSymptoms,
      includePcbData,
      pcbData,
      selectedMeasurements,
      pathComparisons.length > 0 ? pathComparisons : undefined
    );
    
    // Call AI service
    const request: AITextAnalysisRequest = { prompt };
    const response = await aiService.analyzeText(request);
    
    if (!response.success) {
      return { success: false, error: response.error || 'Unknown error occurred' };
    }
    
    return { success: true, results: response.text };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
