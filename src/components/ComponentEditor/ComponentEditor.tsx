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

/**
 * ComponentEditor component
 * Dialog for editing component properties
 */

import React, { useState, useEffect, useRef } from 'react';
import type { PCBComponent } from '../../types';
import type { ComponentDefinition } from '../../data/componentDefinitions.d';
import { InfoDialog } from '../InfoDialog/InfoDialog';
import { COMPONENT_TYPE_INFO, formatComponentTypeName } from '../../constants';
import { ComponentTypeFields } from './ComponentTypeFields';
import { resolveComponentDefinition } from '../../utils/componentDefinitionResolver';
import { isComponentPolarized } from '../../utils/components';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use jsdelivr CDN which is more reliable
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

// Google Gemini API configuration
// API key priority:
// 1. User-provided key from localStorage (for production/GitHub Pages)
// 2. Build-time environment variable (for development)
// This ensures no API key is exposed in production builds
const getGeminiApiKey = (): string | null => {
  // First check localStorage (user-provided, secure for production)
  if (typeof window !== 'undefined') {
    const userKey = localStorage.getItem('geminiApiKey');
    if (userKey && userKey.trim()) {
      return userKey.trim();
    }
  }
  // Fallback to build-time env var (development only)
  return import.meta.env.VITE_GEMINI_API_KEY || null;
};

// Use v1 API and gemini-2.5-flash (latest stable, fast model)
// Alternative: 'gemini-2.5-pro' for better quality (slower)
const GEMINI_MODEL = 'gemini-2.5-flash';
const getGeminiApiUrl = (): string | null => {
  const apiKey = getGeminiApiKey();
  return apiKey 
    ? `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
    : null;
};

// Helper function to get default abbreviation from component type
const getDefaultAbbreviation = (componentType: string): string => {
  const info = COMPONENT_TYPE_INFO[componentType as keyof typeof COMPONENT_TYPE_INFO];
  if (!info || !info.prefix || info.prefix.length < 1) {
    return '?';
  }
  // Use just the first letter of the first prefix
  const firstPrefix = info.prefix[0];
  return firstPrefix.substring(0, 1).toUpperCase();
};

export interface ComponentEditorProps {
  /** Component editor state */
  componentEditor: {
    visible: boolean;
    layer: 'top' | 'bottom';
    id: string;
    designator: string;
    abbreviation: string;
    manufacturer: string;
    partNumber: string;
    pinCount: number;
    x: number;
    y: number;
    orientation?: number;
    [key: string]: any; // For type-specific fields
  } | null;
  /** Component definition (metadata) */
  componentDefinition?: ComponentDefinition;
  /** Set component editor state */
  setComponentEditor: (editor: any) => void;
  /** Components on top layer */
  componentsTop: PCBComponent[];
  /** Components on bottom layer */
  componentsBottom: PCBComponent[];
  /** Set components on top layer */
  setComponentsTop: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  /** Set components on bottom layer */
  setComponentsBottom: (updater: (prev: PCBComponent[]) => PCBComponent[]) => void;
  /** Connecting pin state */
  connectingPin: { componentId: string; pinIndex: number } | null;
  /** Set connecting pin state */
  setConnectingPin: (pin: { componentId: string; pinIndex: number } | null) => void;
  /** Dialog position */
  componentDialogPosition: { x: number; y: number } | null;
  /** Set dialog position */
  setComponentDialogPosition: (pos: { x: number; y: number } | null) => void;
  /** Is dragging dialog */
  isDraggingDialog: boolean;
  /** Set is dragging dialog */
  setIsDraggingDialog: (dragging: boolean) => void;
  /** Dialog drag offset */
  dialogDragOffset: { x: number; y: number } | null;
  /** Set dialog drag offset */
  setDialogDragOffset: (offset: { x: number; y: number } | null) => void;
  /** Are components locked */
  areComponentsLocked: boolean;
  /** Set selected component IDs */
  setSelectedComponentIds: (ids: Set<string>) => void;
  /** Set notes dialog visible */
  setNotesDialogVisible: (visible: boolean) => void;
}

export const ComponentEditor: React.FC<ComponentEditorProps> = ({
  componentEditor,
  componentDefinition,
  setComponentEditor,
  componentsTop,
  componentsBottom,
  setComponentsTop,
  setComponentsBottom,
  connectingPin,
  setConnectingPin,
  componentDialogPosition,
  setComponentDialogPosition: _setComponentDialogPosition,
  isDraggingDialog,
  setIsDraggingDialog,
  dialogDragOffset: _dialogDragOffset,
  setDialogDragOffset,
  areComponentsLocked,
  setSelectedComponentIds,
  setNotesDialogVisible,
}) => {
  const [isFetchingPinNames, setIsFetchingPinNames] = useState(false);
  const [uploadedDatasheetFile, setUploadedDatasheetFile] = useState<File | null>(null);
  const [showApiKeyInstructions, setShowApiKeyInstructions] = useState(false);
  // API key input state - must be at top level (React Rules of Hooks)
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('geminiApiKey') || '';
    }
    return '';
  });
  // Dialog resize state
  const [dialogSize, setDialogSize] = useState(() => {
    const saved = localStorage.getItem('componentDialogSize');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { width: 350, height: window.innerHeight * 0.4 };
      }
    }
    return { width: 350, height: window.innerHeight * 0.4 };
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [infoDialog, setInfoDialog] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'info' | 'success',
  });
  
  // Find the component being edited - check both layers in case layer was changed
  // This must be computed before useEffect but after hooks are declared
  const comp = React.useMemo(() => {
    if (!componentEditor || !componentEditor.visible) {
      return null;
    }
    let found = componentsTop.find(c => c.id === componentEditor.id);
    if (!found) {
      found = componentsBottom.find(c => c.id === componentEditor.id);
    }
    return found || null;
  }, [componentEditor, componentsTop, componentsBottom]);
  
  // Restore uploaded datasheet file name from component data when component changes
  // Note: We only restore the file name for display, not the actual file (which is local to user's machine)
  // This hook MUST be called unconditionally (Rules of Hooks)
  React.useEffect(() => {
    // Additional validation inside useEffect for safety
    if (!comp) {
      setUploadedDatasheetFile(null);
      return;
    }
    
    const compId = comp.id; // Store for use in error messages
    const compType = comp.componentType; // Store for type narrowing
    const compTypeAny = (comp as any).componentType; // For legacy 'Semiconductor' check
    
    if (!compType) {
      console.error('[ComponentEditor useEffect] Component missing componentType:', { comp, componentId: compId });
      setUploadedDatasheetFile(null);
      return;
    }
    
    if (compType === 'IntegratedCircuit' || compTypeAny === 'Semiconductor') {
      const ic = comp as any;
      if (ic.datasheetFileName) {
        // We have the file name and potentially file data stored in the component
        // The file input will be empty, but we can display the file name as a clickable link
        // Set uploadedDatasheetFile to null since we don't have the actual File object
        setUploadedDatasheetFile(null);
        // Restore file data to componentEditor if available
        if (ic.datasheetFileData && componentEditor && !componentEditor.datasheetFileData) {
          setComponentEditor({
            ...componentEditor,
            datasheetFileData: ic.datasheetFileData,
            datasheetFileName: ic.datasheetFileName,
          });
        }
      } else {
        setUploadedDatasheetFile(null);
      }
    } else {
      setUploadedDatasheetFile(null);
    }
  }, [comp?.id, comp?.componentType, (comp as any)?.datasheetFileName, (comp as any)?.datasheetFileData]);
  
  // Handle resize mouse events
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newWidth = Math.max(350, Math.min(window.innerWidth - 20, resizeStart.width + deltaX));
      const newHeight = Math.max(200, Math.min(window.innerHeight - 20, resizeStart.height + deltaY));
      const newSize = { width: newWidth, height: newHeight };
      setDialogSize(newSize);
      localStorage.setItem('componentDialogSize', JSON.stringify(newSize));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart]);

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: dialogSize.width,
      height: dialogSize.height,
    });
  };
  
  // Early returns AFTER all hooks are declared
  if (!componentEditor || !componentEditor.visible) {
    return null;
  }
  
  // Validate component exists and has required properties
  if (!comp) {
    console.error('[ComponentEditor] Component not found:', { componentId: componentEditor.id, componentsTopCount: componentsTop.length, componentsBottomCount: componentsBottom.length });
    return null;
  }
  
  if (!comp.id || !comp.componentType || typeof comp.pinCount !== 'number') {
    console.error('[ComponentEditor] Component missing required properties:', { componentId: comp.id, hasComponentType: !!comp.componentType, componentType: comp.componentType, pinCount: comp.pinCount, pinCountType: typeof comp.pinCount, component: comp });
    return null;
  }
  
  // Determine actual layer
  let actualLayer: 'top' | 'bottom' = 'top';
  if (!componentsTop.find(c => c.id === componentEditor.id)) {
    actualLayer = 'bottom';
  }
  
  // Update componentEditor layer if it doesn't match the actual component's layer
  if (componentEditor.layer !== actualLayer) {
    setComponentEditor({ ...componentEditor, layer: actualLayer });
  }

  // Update component function - handles all component type-specific save logic
  const updateComponent = (comp: PCBComponent): PCBComponent => {
    // Create a deep copy to ensure all properties are preserved, including custom ones like datasheet
    const updated = { ...comp } as any;
    console.log('[ComponentEditor] updateComponent - Entry:', {
      componentId: comp.id,
      componentType: comp.componentType,
      editorDatasheet: componentEditor.datasheet,
      editorDatasheetType: typeof componentEditor.datasheet,
      originalComponentDatasheet: (comp as any).datasheet
    });
    // Always use the designator field value directly (not abbreviation)
    // The designator field is the source of truth for the component's designator
    const designator = componentEditor.designator?.trim() || '';
    updated.designator = designator;
    updated.x = componentEditor.x;
    updated.y = componentEditor.y;
    updated.layer = componentEditor.layer;
    updated.orientation = componentEditor.orientation ?? 0;
    // Derive abbreviation from designator (first character)
    const abbreviation = designator.length > 0 ? designator.charAt(0).toUpperCase() : getDefaultAbbreviation(comp.componentType);
    (updated as any).abbreviation = abbreviation;
    if ('manufacturer' in updated) {
      (updated as any).manufacturer = componentEditor.manufacturer?.trim() || undefined;
    }
    if ('partNumber' in updated) {
      (updated as any).partNumber = componentEditor.partNumber?.trim() || undefined;
    }
    // Update pin count if changed
    if (componentEditor.pinCount !== comp.pinCount) {
      updated.pinCount = componentEditor.pinCount;
      // Resize pinConnections array, preserving existing connections
      const currentConnections = comp.pinConnections || [];
      updated.pinConnections = new Array(componentEditor.pinCount).fill('').map((_, i) => 
        i < currentConnections.length ? currentConnections[i] : ''
      );
      // Resize pinPolarities array if it exists, preserving existing polarities
      if (comp.pinPolarities) {
        const currentPolarities = comp.pinPolarities || [];
        updated.pinPolarities = new Array(componentEditor.pinCount).fill('').map((_, i) => 
          i < currentPolarities.length ? currentPolarities[i] : ''
        );
      }
      // Resize pinNames array if it exists, preserving existing names
      if ((comp as any).pinNames) {
        const currentPinNames = (comp as any).pinNames || [];
        (updated as any).pinNames = new Array(componentEditor.pinCount).fill('').map((_, i) => 
          i < currentPinNames.length ? currentPinNames[i] : ''
        );
      }
    } else {
      // Preserve existing pinConnections even if pin count didn't change
      updated.pinConnections = comp.pinConnections || [];
      // Preserve existing pinPolarities if they exist
      if (comp.pinPolarities) {
        updated.pinPolarities = comp.pinPolarities;
      }
      // Preserve existing pinNames if they exist
      if ((comp as any).pinNames) {
        (updated as any).pinNames = (comp as any).pinNames;
      }
    }
    
    // Update type-specific fields based on component type
    // Save separate value and unit fields
    if (comp.componentType === 'Resistor') {
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
    } else if (comp.componentType === 'Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      (updated as any).dielectric = componentEditor.dielectric || undefined;
    } else if (comp.componentType === 'Electrolytic Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      // polarized is now a fixed property from definition, not user-editable
      (updated as any).esr = componentEditor.esr || undefined;
      (updated as any).esrUnit = componentEditor.esrUnit || undefined;
      (updated as any).temperature = componentEditor.temperature || undefined;
    } else if (comp.componentType === 'Film Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      (updated as any).filmType = componentEditor.filmType || undefined;
    } else if (comp.componentType === 'Diode') {
      // Pre-fill diodeType from component's diodeType property (set during creation from radio button selection)
      (updated as any).diodeType = componentEditor.diodeType || (comp as any).diodeType || 'Standard';
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).ledColor = componentEditor.ledColor || undefined;
    } else if (comp.componentType === 'Battery') {
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).capacity = componentEditor.capacity || undefined;
      (updated as any).capacityUnit = componentEditor.capacityUnit || undefined;
      (updated as any).chemistry = componentEditor.chemistry || undefined;
    } else if (comp.componentType === 'Fuse') {
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).fuseType = componentEditor.fuseType || undefined;
    } else if (comp.componentType === 'FerriteBead') {
      (updated as any).impedance = componentEditor.impedance || undefined;
      (updated as any).impedanceUnit = componentEditor.impedanceUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'Connector') {
      (updated as any).connectorType = componentEditor.connectorType || undefined;
      (updated as any).gender = componentEditor.gender || undefined;
    } else if (comp.componentType === 'Jumper') {
      (updated as any).positions = componentEditor.positions || undefined;
    } else if (comp.componentType === 'Relay') {
      (updated as any).coilVoltage = componentEditor.coilVoltage || undefined;
      (updated as any).coilVoltageUnit = componentEditor.coilVoltageUnit || undefined;
      (updated as any).contactType = componentEditor.contactType || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'Inductor') {
      (updated as any).inductance = componentEditor.inductance || undefined;
      (updated as any).inductanceUnit = componentEditor.inductanceUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
    } else if (comp.componentType === 'Speaker') {
      (updated as any).impedance = componentEditor.impedance || undefined;
      (updated as any).impedanceUnit = componentEditor.impedanceUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
    } else if (comp.componentType === 'Motor') {
      (updated as any).motorType = componentEditor.motorType || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'PowerSupply') {
      (updated as any).inputVoltage = componentEditor.inputVoltage || undefined;
      (updated as any).inputVoltageUnit = componentEditor.inputVoltageUnit || undefined;
      (updated as any).outputVoltage = componentEditor.outputVoltage || undefined;
      (updated as any).outputVoltageUnit = componentEditor.outputVoltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'Transistor') {
      (updated as any).transistorType = componentEditor.transistorType || undefined;
      (updated as any).polarity = componentEditor.polarity || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
    } else if (comp.componentType === 'ResistorNetwork') {
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      (updated as any).configuration = componentEditor.configuration || undefined;
    } else if (comp.componentType === 'Thermistor') {
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      (updated as any).thermistorType = componentEditor.thermistorType || undefined;
      (updated as any).beta = componentEditor.beta || undefined;
    } else if (comp.componentType === 'Switch') {
      (updated as any).switchType = componentEditor.switchType || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
    } else if (comp.componentType === 'Transformer') {
      (updated as any).primaryVoltage = componentEditor.primaryVoltage || undefined;
      (updated as any).primaryVoltageUnit = componentEditor.primaryVoltageUnit || undefined;
      (updated as any).secondaryVoltage = componentEditor.secondaryVoltage || undefined;
      (updated as any).secondaryVoltageUnit = componentEditor.secondaryVoltageUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).turns = componentEditor.turns || undefined;
    } else if (comp.componentType === 'TestPoint') {
      (updated as any).signal = componentEditor.signal || undefined;
    } else if ((comp.componentType as string) === 'Film Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance || undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit || undefined;
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
      (updated as any).filmType = componentEditor.filmType || undefined;
    } else if (comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') {
      // For ICs, save description from the Description field
      // Handle both 'IntegratedCircuit' and legacy 'Semiconductor' componentType
      updated.description = componentEditor.description?.trim() || undefined;
      // Save datasheet - ALWAYS save the value from componentEditor, even if empty
      // The key is to preserve whatever the user entered
      const datasheetValue = componentEditor.datasheet;
      console.log('[ComponentEditor] updateComponent - IntegratedCircuit/Semiconductor block:', {
        componentType: comp.componentType,
        editorDatasheet: componentEditor.datasheet,
        editorDatasheetType: typeof componentEditor.datasheet,
        editorDatasheetLength: componentEditor.datasheet?.length,
        originalComponentDatasheet: (comp as any).datasheet,
        datasheetValue: datasheetValue
      });
      
      // Always set the datasheet property - preserve empty string if user cleared it, or the value if they entered one
      if (datasheetValue !== undefined && datasheetValue !== null) {
        const trimmed = datasheetValue.trim();
        updated.datasheet = trimmed.length > 0 ? trimmed : '';
      } else {
        // If datasheet is undefined/null in editor, preserve the original or set to undefined
        updated.datasheet = (comp as any).datasheet || undefined;
      }
      
      // Ensure componentType is set correctly (fix legacy 'Semiconductor' to 'IntegratedCircuit')
      if ((comp as any).componentType === 'Semiconductor') {
        updated.componentType = 'IntegratedCircuit';
      }
      
      console.log('[ComponentEditor] updateComponent - Final datasheet value:', updated.datasheet);
      updated.icType = componentEditor.icType || undefined;
      
      // Save uploaded datasheet file name and file data (as data URL)
      if (uploadedDatasheetFile) {
        (updated as any).datasheetFileName = uploadedDatasheetFile.name;
        // File data should already be in componentEditor.datasheetFileData from the onChange handler
        if (componentEditor.datasheetFileData) {
          (updated as any).datasheetFileData = componentEditor.datasheetFileData;
        }
      } else if (componentEditor.datasheetFileData) {
        // Keep existing file data if no new file is uploaded
        (updated as any).datasheetFileData = componentEditor.datasheetFileData;
        (updated as any).datasheetFileName = componentEditor.datasheetFileName || (comp as any)?.datasheetFileName;
      } else {
        // Clear file data if explicitly removed
        (updated as any).datasheetFileName = undefined;
        (updated as any).datasheetFileData = undefined;
      }
    } else {
      // For non-IC components, save description from the Description field
      (updated as any).description = componentEditor.description?.trim() || undefined;
    }
    
    if (comp.componentType === 'VacuumTube') {
      (updated as any).tubeType = componentEditor.tubeType || undefined;
    } else if (comp.componentType === 'VariableResistor') {
      (updated as any).vrType = componentEditor.vrType || undefined;
      (updated as any).resistance = componentEditor.resistance || undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit || undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).taper = componentEditor.taper || undefined;
    } else if (comp.componentType === 'Crystal') {
      (updated as any).frequency = componentEditor.frequency || undefined;
      (updated as any).loadCapacitance = componentEditor.loadCapacitance || undefined;
      (updated as any).tolerance = componentEditor.tolerance || undefined;
    } else if (comp.componentType === 'GenericComponent') {
      (updated as any).genericType = componentEditor.genericType || 'Attenuator';
      (updated as any).voltage = componentEditor.voltage || undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit || undefined;
      (updated as any).current = componentEditor.current || undefined;
      (updated as any).currentUnit = componentEditor.currentUnit || undefined;
      (updated as any).power = componentEditor.power || undefined;
      (updated as any).frequency = componentEditor.frequency || undefined;
      (updated as any).model = componentEditor.model || undefined;
    }
    
    return updated;
  };

  const handleSave = () => {
    // Don't allow saving if components are locked
    if (areComponentsLocked) {
      alert('Cannot edit: Components are locked. Unlock components to edit them.');
      return;
    }

    // Handle layer changes - move component between layers if needed
    // First, find the component in either layer array
    const compInTop = componentsTop.find(c => c.id === componentEditor.id);
    const compInBottom = componentsBottom.find(c => c.id === componentEditor.id);
    const currentComp = compInTop || compInBottom;
    
    if (currentComp) {
      // Component exists - update it
      // Debug: Log datasheet before and after update for IntegratedCircuit components
      if (currentComp.componentType === 'IntegratedCircuit') {
        console.log('[ComponentEditor] handleSave - Before updateComponent call:', {
          componentDatasheet: (currentComp as any).datasheet,
          editorDatasheet: componentEditor.datasheet,
          editorDatasheetType: typeof componentEditor.datasheet,
          editorDatasheetLength: componentEditor.datasheet?.length,
          fullEditor: componentEditor
        });
      }
      const updatedComp = updateComponent(currentComp);
      if (currentComp.componentType === 'IntegratedCircuit') {
        console.log('[ComponentEditor] handleSave - After updateComponent call:', {
          updatedComponentDatasheet: (updatedComp as any).datasheet,
          updatedComponentDatasheetType: typeof (updatedComp as any).datasheet
        });
      }
      
      // Check if layer changed
      const oldLayer = currentComp.layer;
      const newLayer = componentEditor.layer;
      
      if (oldLayer !== newLayer) {
        // Layer changed - move component between arrays
        if (oldLayer === 'top') {
          // Remove from top, add to bottom
          setComponentsTop(prev => prev.filter(c => c.id !== componentEditor.id));
          setComponentsBottom(prev => [...prev, updatedComp]);
        } else {
          // Remove from bottom, add to top
          setComponentsBottom(prev => prev.filter(c => c.id !== componentEditor.id));
          setComponentsTop(prev => [...prev, updatedComp]);
        }
      } else {
        // Layer unchanged - update in place
        if (newLayer === 'top') {
          setComponentsTop(prev => {
            const updated = prev.map(c => {
              if (c.id === componentEditor.id) {
                console.log('[ComponentEditor] Updating component in top array - datasheet:', (updatedComp as any).datasheet);
                return updatedComp;
              }
              return c;
            });
            // Verify the update worked
            const found = updated.find(c => c.id === componentEditor.id);
            if (found && found.componentType === 'IntegratedCircuit') {
              console.log('[ComponentEditor] After state update - component datasheet in array:', (found as any).datasheet);
            }
            return updated;
          });
        } else {
          setComponentsBottom(prev => {
            const updated = prev.map(c => {
              if (c.id === componentEditor.id) {
                console.log('[ComponentEditor] Updating component in bottom array - datasheet:', (updatedComp as any).datasheet);
                return updatedComp;
              }
              return c;
            });
            // Verify the update worked
            const found = updated.find(c => c.id === componentEditor.id);
            if (found && found.componentType === 'IntegratedCircuit') {
              console.log('[ComponentEditor] After state update - component datasheet in array:', (found as any).datasheet);
            }
            return updated;
          });
        }
      }
    } else {
      // Component not found - this shouldn't happen, but handle gracefully
      console.warn(`Component ${componentEditor.id} not found in either layer array`);
      // Try to find in the other layer and move it, or create a minimal component
      // This is a fallback that shouldn't normally be needed
      if (componentEditor.layer === 'top') {
        const compInBottom = componentsBottom.find(c => c.id === componentEditor.id);
        if (compInBottom) {
          const updatedComp = updateComponent(compInBottom);
          setComponentsBottom(prev => prev.filter(c => c.id !== componentEditor.id));
          setComponentsTop(prev => [...prev, updatedComp]);
        }
      } else {
        const compInTop = componentsTop.find(c => c.id === componentEditor.id);
        if (compInTop) {
          const updatedComp = updateComponent(compInTop);
          setComponentsTop(prev => prev.filter(c => c.id !== componentEditor.id));
          setComponentsBottom(prev => [...prev, updatedComp]);
        }
      }
    }
    
    setComponentEditor(null);
    setConnectingPin(null); // Clear pin connection mode
  };

  // Function to fetch and parse pin names from datasheet - moved to top level
  const handleFetchPinNames = async () => {
    // Check if API key is configured
    const apiKey = getGeminiApiKey();
    const apiUrl = getGeminiApiUrl();
    
    if (!apiKey || !apiUrl) {
      const message = 'Gemini API key is not configured.\n\n' +
        'For production/GitHub Pages: Enter your API key in the field below.\n' +
        'For development: Create a .env file with VITE_GEMINI_API_KEY=your_api_key_here\n\n' +
        'Get your free API key from: https://aistudio.google.com/apikey';
      alert(message);
      return;
    }
    
    // Prefer uploaded file over URL
    if (!uploadedDatasheetFile) {
      const datasheetUrl = (componentEditor as any)?.datasheet?.trim();
      if (!datasheetUrl) {
        setInfoDialog({
          visible: true,
          title: 'Datasheet Required',
          message: 'Please upload a datasheet PDF file or enter a datasheet URL above before extracting information.',
          type: 'info',
        });
        return;
      }
    }
    
    setIsFetchingPinNames(true);
    
    try {
      let arrayBuffer: ArrayBuffer;
      
      if (uploadedDatasheetFile) {
        // Use uploaded file - no CORS issues!
        arrayBuffer = await uploadedDatasheetFile.arrayBuffer();
      } else {
        // Fall back to URL fetch
        const datasheetUrl = (componentEditor as any)?.datasheet?.trim();
        
        // Try direct fetch first
        try {
          const response = await fetch(datasheetUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch datasheet: ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        } catch (directFetchError) {
          // If direct fetch fails (likely CORS), try using a CORS proxy
          console.log('Direct fetch failed, trying CORS proxy...', directFetchError);
          
          // Use a CORS proxy service
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(datasheetUrl)}`;
          
          try {
            const proxyResponse = await fetch(proxyUrl);
            if (!proxyResponse.ok) {
              throw new Error(`CORS proxy failed: ${proxyResponse.statusText}`);
            }
            arrayBuffer = await proxyResponse.arrayBuffer();
          } catch (proxyError) {
            // If proxy also fails, provide helpful error message
            throw new Error(
              'Unable to fetch datasheet due to CORS restrictions. ' +
              'Please download the PDF and upload it using the file input above. ' +
              `Original error: ${directFetchError instanceof Error ? directFetchError.message : 'Unknown error'}`
            );
          }
        }
      }
      
      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Extract text from all pages
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      // Use Google Gemini AI to extract pin information
      // Limit text length to avoid token limits (Gemini Pro has ~32k token limit)
      const maxTextLength = 20000; // Conservative limit to leave room for prompt and response
      const truncatedText = fullText.length > maxTextLength 
        ? fullText.substring(0, maxTextLength) + '\n[... text truncated ...]'
        : fullText;

      // Get the current component
      const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
      const currentComp = currentCompList.find(c => c.id === componentEditor.id);
      
      if (!currentComp) {
        throw new Error('Component not found');
      }
      
      // Get component definition to know what fields are available
      const def: ComponentDefinition | undefined = componentDefinition || resolveComponentDefinition(currentComp as any);
      const availableFields = def?.fields || [];
      
      // Build list of fields to extract (excluding datasheet field)
      const fieldsToExtract = availableFields
        .filter(field => field.name !== 'datasheet')
        .map(field => ({
          name: field.name,
          label: field.label,
          type: field.type,
          hasUnits: Boolean(field.units && field.units.length > 0),
          units: field.units || []
        }));

      const prompt = `You are analyzing an electronic component datasheet. Extract pin information, component properties, a datasheet summary, IC type, and pin count, then return the data as a JSON object.

Requirements:
1. Return a JSON object with three sections: "pins", "properties", and "summary"
2. First, determine the total number of pins (pinCount) for this component from the datasheet. This should be a positive integer representing the total number of pins/pads on the component.
3. For pins, extract information for ALL pins found in the datasheet (not just a subset). For each pin, provide:
   - pinNumber: The pin number (1, 2, 3, etc.)
   - pinName: The signal name (e.g., VCC, GND, IN+, OUT, etc.). Use the exact name from the datasheet.
   - pinDescription: A brief description of the pin's function (optional, can be empty string)
4. For component properties, extract the following information if available in the datasheet:
${fieldsToExtract.map(field => {
  if (field.hasUnits) {
    return `   - ${field.name}: The ${field.label.toLowerCase()} value (as a number) and ${field.name}Unit: The unit (one of: ${field.units.join(', ')})`;
  } else if (field.type === 'enum') {
    return `   - ${field.name}: The ${field.label.toLowerCase()} (as a string)`;
  } else {
    return `   - ${field.name}: The ${field.label.toLowerCase()} (as a string or number, depending on the field type)`;
  }
}).join('\n')}
5. For IC Type (icType), determine the type of integrated circuit from the datasheet. Choose from: "Op-Amp", "Microcontroller", "Microprocessor", "Logic", "Memory", "Voltage Regulator", "Timer", "ADC", "DAC", "Comparator", "Transceiver", "Driver", "Amplifier", or "Other". If it's clearly an op amp, use "Op-Amp". If it's clearly a microcontroller, use "Microcontroller", etc.
6. For pin count (pinCount), determine the total number of pins/pads on the component from the datasheet. This should be a positive integer. Include this in the properties section.
7. For datasheet summary (datasheetSummary), provide a concise summary (2-4 sentences) of the introductory information from the datasheet, including what the component is, its main purpose, and key features mentioned in the introduction or overview section.
8. Only include properties that are actually found in the datasheet - do not make up values
9. For numeric fields with units, extract both the numeric value and the appropriate unit
10. Return ONLY valid JSON, no additional text, explanations, or markdown formatting

Example JSON format:
{
  "pins": [
    {"pinNumber": 1, "pinName": "VCC", "pinDescription": "Power supply positive"},
    {"pinNumber": 2, "pinName": "GND", "pinDescription": "Ground"},
    {"pinNumber": 3, "pinName": "IN+", "pinDescription": "Non-inverting input"},
    {"pinNumber": 4, "pinName": "IN-", "pinDescription": "Inverting input"},
    {"pinNumber": 5, "pinName": "OUT", "pinDescription": "Output"}
  ],
  "properties": {
    "partNumber": "LM358",
    "manufacturer": "Texas Instruments",
    "voltage": 36,
    "voltageUnit": "V",
    "description": "Dual operational amplifier",
    "icType": "Op-Amp",
    "pinCount": 5
  },
  "summary": {
    "datasheetSummary": "The LM358 is a dual operational amplifier featuring low power consumption and wide supply voltage range. It is designed for single supply operation from 3V to 32V or dual supplies from ±1.5V to ±16V. The device offers high gain bandwidth product and low input offset voltage."
  }
}

Datasheet text:
${truncatedText}`;

      // Call Google Gemini API
      const geminiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        let errorMessage = `Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.message) {
            errorMessage += `. ${errorJson.error.message}`;
          }
        } catch {
          errorMessage += `. ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      const geminiData = await geminiResponse.json();
      
      // Extract the response text
      let responseText = '';
      if (geminiData.candidates && geminiData.candidates[0]) {
        // Check for finish reason (safety/content filters)
        if (geminiData.candidates[0].finishReason && 
            geminiData.candidates[0].finishReason !== 'STOP') {
          throw new Error(`Gemini API response blocked: ${geminiData.candidates[0].finishReason}`);
        }
        
        if (geminiData.candidates[0].content && geminiData.candidates[0].content.parts) {
          const parts = geminiData.candidates[0].content.parts;
          if (parts && parts[0] && parts[0].text) {
            responseText = parts[0].text.trim();
          }
        }
      }

      if (!responseText) {
        throw new Error('No response text from Gemini API. The API may have returned an empty response.');
      }

      // Parse JSON response
      // Remove markdown code blocks if present (Gemini sometimes wraps in ```json or ```)
      responseText = responseText.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');
      
      let extractedData: any;
      try {
        extractedData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response from Gemini API: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      if (!extractedData || typeof extractedData !== 'object') {
        throw new Error('Invalid JSON response from Gemini API: expected an object');
      }

      // Extract pin count first (if provided)
      let extractedPinCount = componentEditor.pinCount; // Default to current pin count
      if (extractedData.properties && typeof extractedData.properties === 'object' && extractedData.properties.pinCount) {
        const pinCountValue = parseInt(String(extractedData.properties.pinCount), 10);
        if (!isNaN(pinCountValue) && pinCountValue > 0) {
          extractedPinCount = pinCountValue;
        }
      } else if (extractedData.pins && Array.isArray(extractedData.pins)) {
        // If pinCount not in properties, determine from pins array
        let maxPinNum = 0;
        for (const pin of extractedData.pins) {
          if (pin && typeof pin === 'object' && pin.pinNumber) {
            const pinNum = parseInt(String(pin.pinNumber), 10);
            if (!isNaN(pinNum) && pinNum > maxPinNum) {
              maxPinNum = pinNum;
            }
          }
        }
        if (maxPinNum > 0) {
          extractedPinCount = maxPinNum;
        }
      }

      // Extract pin names - use extracted pin count
      const pinNames: string[] = new Array(extractedPinCount).fill('');
      let parsedPinCount = 0;
      
      if (extractedData.pins && Array.isArray(extractedData.pins)) {
        for (const pin of extractedData.pins) {
          if (pin && typeof pin === 'object' && pin.pinNumber && pin.pinName) {
            const pinNum = parseInt(String(pin.pinNumber), 10);
            if (!isNaN(pinNum) && pinNum >= 1 && pinNum <= extractedPinCount) {
              pinNames[pinNum - 1] = String(pin.pinName).trim();
              parsedPinCount++;
            }
          }
        }
      }

      if (parsedPinCount === 0) {
        throw new Error('Could not parse any pin information from the JSON response.');
      }

      // Extract component properties and update componentEditor
      const updatedEditor: any = { ...componentEditor };
      let propertiesExtracted = 0;
      
      // Update pin count if extracted
      if (extractedPinCount !== componentEditor.pinCount) {
        updatedEditor.pinCount = extractedPinCount;
        propertiesExtracted++;
      }
      
      if (extractedData.properties && typeof extractedData.properties === 'object') {
        const props = extractedData.properties;
        
        // Update each field that was found in the response
        for (const field of fieldsToExtract) {
          if (props.hasOwnProperty(field.name)) {
            const value = props[field.name];
            
            if (value !== null && value !== undefined && value !== '') {
              if (field.hasUnits) {
                // For fields with units, extract both value and unit
                updatedEditor[field.name] = String(value);
                const unitKey = `${field.name}Unit`;
                if (props.hasOwnProperty(unitKey)) {
                  const unit = String(props[unitKey]).trim();
                  // Validate unit is in the allowed list
                  if (field.units.includes(unit)) {
                    updatedEditor[unitKey] = unit;
                  } else if (field.units.length > 0) {
                    // Use default unit if provided unit is not valid
                    updatedEditor[unitKey] = field.units[0];
                  }
                } else if (field.units.length > 0) {
                  // Use default unit if not provided
                  updatedEditor[unitKey] = field.units[0];
                }
              } else {
                // For fields without units, just set the value
                updatedEditor[field.name] = String(value);
              }
              propertiesExtracted++;
            }
          }
        }
        
        // Handle IC Type if present
        if (props.hasOwnProperty('icType') && props.icType) {
          const icType = String(props.icType).trim();
          const validIcTypes = ['Op-Amp', 'Microcontroller', 'Microprocessor', 'Logic', 'Memory', 'Voltage Regulator', 'Timer', 'ADC', 'DAC', 'Comparator', 'Transceiver', 'Driver', 'Amplifier', 'Other'];
          if (validIcTypes.includes(icType)) {
            updatedEditor.icType = icType;
            propertiesExtracted++;
          }
        }
      }
      
      // Handle datasheet summary (for Notes field) - will be merged into component update below
      let datasheetSummary = '';
      if (extractedData.summary && typeof extractedData.summary === 'object' && extractedData.summary.datasheetSummary) {
        datasheetSummary = String(extractedData.summary.datasheetSummary).trim();
        if (datasheetSummary) {
          // Update componentEditor to reflect the notes change
          updatedEditor.notes = datasheetSummary;
          propertiesExtracted++;
        }
      }

      // Update componentEditor state with extracted properties
      setComponentEditor(updatedEditor);
      
      // Update component with fetched pin names and pin count
      if (currentComp) {
        // Update pin connections array to match new pin count if it changed
        const existingPinConnections = currentComp.pinConnections || [];
        const newPinConnections = new Array(extractedPinCount).fill('').map((_, i) => 
          i < existingPinConnections.length ? existingPinConnections[i] : ''
        );
        
        // Update pin polarities array to match new pin count if it changed
        const existingPinPolarities = currentComp.pinPolarities || [];
        const newPinPolarities = new Array(extractedPinCount).fill('').map((_, i) => 
          i < existingPinPolarities.length ? existingPinPolarities[i] : ''
        );
        
        // Ensure pinNames array matches pin count
        const adjustedPinNames = [...pinNames];
        while (adjustedPinNames.length < extractedPinCount) {
          adjustedPinNames.push('');
        }
        
        const updatedComp = { 
          ...currentComp, 
          pinNames: adjustedPinNames,
          pinCount: extractedPinCount,
          pinConnections: newPinConnections,
          pinPolarities: newPinPolarities,
          // Include datasheet summary in notes if available
          ...(datasheetSummary && { notes: datasheetSummary })
        };
        
        if (componentEditor.layer === 'top') {
          setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
        } else {
          setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
        }
        
        const foundCount = pinNames.filter(name => name.length > 0).length;
        let message = `Extracted ${foundCount} pin name${foundCount !== 1 ? 's' : ''}`;
        if (extractedPinCount !== componentEditor.pinCount) {
          message += ` and pin count`;
        }
        if (propertiesExtracted > 0) {
          message += ` and ${propertiesExtracted} propert${propertiesExtracted === 1 ? 'y' : 'ies'}`;
        }
        message += ' from datasheet.';
        setInfoDialog({
          visible: true,
          title: 'Extraction Complete',
          message: message,
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error fetching pin names:', error);
      setInfoDialog({
        visible: true,
        title: 'Extraction Failed',
        message: `Failed to extract information: ${error instanceof Error ? error.message : 'Unknown error'}. Please enter pin names manually.`,
        type: 'info',
      });
    } finally {
      setIsFetchingPinNames(false);
    }
  };

  // Function to save API key - moved to top level
  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('geminiApiKey', apiKeyInput.trim());
      setInfoDialog({
        visible: true,
        title: 'API Key Saved',
        message: 'API key saved! You can now use the "Extract Datasheet Information" feature.',
        type: 'success',
      });
    } else {
      localStorage.removeItem('geminiApiKey');
      setInfoDialog({
        visible: true,
        title: 'API Key Removed',
        message: 'API key removed.',
        type: 'info',
      });
    }
  };

  return (
    <>
      <style>{`
        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.8);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 0 0 8px rgba(76, 175, 80, 0);
          }
        }
        .fetch-pin-names-pulse {
          animation: heartbeat 0.8s ease-in-out infinite;
        }
      `}</style>
      <div
        data-component-editor-dialog
        onClick={(e) => {
          // Don't interfere with pin connection clicks - let document handler deal with it
          if (connectingPin && connectingPin.componentId === comp.id) {
          // Only stop propagation for dialog content (buttons, inputs)
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
            e.stopPropagation();
          }
        }
      }}
      style={{
        position: 'fixed',
        top: componentDialogPosition ? `${componentDialogPosition.y}px` : '90px',
        left: componentDialogPosition ? `${componentDialogPosition.x}px` : `${window.innerWidth - 280}px`,
        transform: 'none', // Position from top-left corner, not centered
        background: connectingPin && connectingPin.componentId === comp.id ? 'rgba(255, 255, 255, 0.95)' : '#fff',
        border: '1px solid #0b5fff',
        borderRadius: 4,
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '350px',
        width: `${dialogSize.width}px`,
        height: `${dialogSize.height}px`,
        maxHeight: `${window.innerHeight - 20}px`,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        cursor: isDraggingDialog ? 'grabbing' : 'default',
      }}
    >
      {/* Fixed header - does not scroll */}
      <div 
        onMouseDown={(e) => {
          // Only start dragging if clicking on the header (not buttons/inputs)
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
            return;
          }
          if (componentDialogPosition) {
            setDialogDragOffset({
              x: e.clientX - componentDialogPosition.x,
              y: e.clientY - componentDialogPosition.y,
            });
            setIsDraggingDialog(true);
            e.preventDefault();
          }
        }}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '6px',
          borderBottom: '1px solid #e0e0e0',
          background: '#888', // Medium gray background for grabbable window border
          cursor: isDraggingDialog ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '13px', color: '#fff', fontWeight: 600 }}>Component Properties</h3>
        <button
          onClick={() => {
            setComponentEditor(null);
            setConnectingPin(null); // Clear pin connection mode
          }}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '15px',
            cursor: 'pointer',
            color: '#fff',
            padding: 0,
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
      
      {/* Scrollable content area */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '4px',
        padding: '6px 20px 6px 6px', // Extra right padding for scrollbar
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}>
        {/* Category and Type (read-only) - at the top for clarity */}
        {(() => {
          // Resolve component definition if not provided as prop
          const def = componentDefinition || resolveComponentDefinition(comp as any);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                Category:
              </label>
              <div style={{ width: '180px', padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '11px', color: '#000' }}>
                {def?.category || 'N/A'}
              </div>
            </div>
          );
        })()}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Type:
          </label>
          <div style={{ width: '180px', padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '11px', color: '#000' }}>
            {(() => {
              // Resolve component definition if not provided as prop
              const def = componentDefinition || resolveComponentDefinition(comp as any);
              // Prefer definition.displayName if available (most accurate) - same logic as Information dialog
              if (def?.displayName) {
                // For capacitors, append "Capacitor" if displayName doesn't already include it
                if (comp.componentType === 'Capacitor' && !def.displayName.toLowerCase().includes('capacitor')) {
                  return `${def.displayName} Capacitor`;
                }
                return def.displayName;
              }
              // Fallback to legacy logic for components without definitions
              if (comp.componentType === 'GenericComponent' && (comp as any).genericType) {
                return formatComponentTypeName((comp as any).genericType);
              }
              if (comp.componentType === 'Diode' && (comp as any).diodeType && (comp as any).diodeType !== 'Standard') {
                return formatComponentTypeName((comp as any).diodeType);
              }
              if (comp.componentType === 'VariableResistor' && (comp as any).vrType && (comp as any).vrType !== 'Potentiometer') {
                return formatComponentTypeName((comp as any).vrType);
              }
              if (comp.componentType === 'Capacitor' && (comp as any).dielectric === 'Tantalum') {
                return 'Tantalum Capacitor';
              }
              if (comp.componentType === 'Capacitor' && (comp as any).capacitorType === 'Electrolytic') {
                return 'Electrolytic Capacitor';
              }
              if (comp.componentType === 'Capacitor' && (comp as any).capacitorType === 'Film') {
                return 'Film Capacitor';
              }
              return formatComponentTypeName(comp.componentType);
            })()}
          </div>
        </div>
        
        {/* Layer (editable) - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-layer-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Layer:
          </label>
          <select
            id={`component-layer-${comp.id}`}
            name={`component-layer-${comp.id}`}
            value={componentEditor.layer}
            onChange={(e) => setComponentEditor({ ...componentEditor, layer: e.target.value as 'top' | 'bottom' })}
            disabled={areComponentsLocked}
            style={{ width: '80px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          >
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
        
        {/* Orientation - moved near top for easy access */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-orientation-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Orientation:
          </label>
          <select
            id={`component-orientation-${comp.id}`}
            name={`component-orientation-${comp.id}`}
            value={componentEditor.orientation ?? 0}
            onChange={(e) => {
              const newOrientation = parseInt(e.target.value) || 0;
              // Update editor state
              setComponentEditor({ ...componentEditor, orientation: newOrientation });
              // Immediately update the component in the array for real-time visual feedback
              if (!areComponentsLocked) {
                const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                if (currentComp) {
                  const updatedComp = { ...currentComp, orientation: newOrientation };
                  if (componentEditor.layer === 'top') {
                    setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  } else {
                    setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  }
                }
              }
            }}
            disabled={areComponentsLocked}
            style={{ width: '70px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          >
            <option value="0">0°</option>
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>
        </div>
        
        {/* Datasheet section - moved to top for semiconductors/ICs */}
        {(comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') && (
          <>
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0', fontSize: '11px', fontWeight: 600, color: '#000' }}>Datasheet:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <label htmlFor={`component-datasheet-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                Datasheet:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                {/* File upload input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                  <input
                    id={`component-datasheet-file-${comp.id}`}
                    type="file"
                    accept=".pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        setUploadedDatasheetFile(file);
                        // Read file as data URL and store in componentEditor for persistence
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          if (dataUrl) {
                            setComponentEditor({
                              ...componentEditor,
                              datasheetFileData: dataUrl,
                              datasheetFileName: file.name,
                            });
                          }
                        };
                        reader.readAsDataURL(file);
                      } else {
                        setUploadedDatasheetFile(null);
                        setComponentEditor({
                          ...componentEditor,
                          datasheetFileData: undefined,
                          datasheetFileName: undefined,
                        });
                      }
                    }}
                    disabled={areComponentsLocked}
                    style={{ 
                      position: 'absolute',
                      width: '0.1px',
                      height: '0.1px',
                      opacity: 0,
                      overflow: 'hidden',
                      zIndex: -1
                    }}
                  />
                  <label
                    htmlFor={`component-datasheet-file-${comp.id}`}
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: 2,
                      fontSize: '11px',
                      color: '#000',
                      cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                      opacity: areComponentsLocked ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                      flex: '0 0 auto'
                    }}
                  >
                    Choose File
                  </label>
                  {(() => {
                    // Determine which file to use: uploaded file (in memory) or stored file data (from component)
                    const fileToUse = uploadedDatasheetFile || 
                      ((comp as any)?.datasheetFileData ? { 
                        name: (comp as any).datasheetFileName || 'PDF file',
                        data: (comp as any).datasheetFileData 
                      } : null);
                    
                    const fileName = uploadedDatasheetFile?.name || (comp as any)?.datasheetFileName;
                    
                    if (fileToUse && fileName) {
                      return (
                        <a
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              let blobUrl: string;
                              if (uploadedDatasheetFile) {
                                // Use the in-memory file
                                blobUrl = URL.createObjectURL(uploadedDatasheetFile);
                              } else if ((comp as any)?.datasheetFileData) {
                                // Convert data URL to blob URL
                                const response = await fetch((comp as any).datasheetFileData);
                                const blob = await response.blob();
                                blobUrl = URL.createObjectURL(blob);
                              } else {
                                return;
                              }
                              
                              const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
                              if (newWindow) {
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                              }
                            } catch (error) {
                              console.error('Error opening datasheet:', error);
                              alert('Failed to open datasheet file.');
                            }
                          }}
                          style={{
                            fontSize: '11px', 
                            color: '#0066cc', 
                            whiteSpace: 'nowrap',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            flex: '0 0 auto'
                          }}
                          title="Click to open PDF in new window"
                        >
                          {fileName}
                        </a>
                      );
                    } else {
                      return (
                        <span style={{ fontSize: '11px', color: '#666', flex: '0 0 auto' }}>No file chosen</span>
                      );
                    }
                  })()}
                </div>
                {/* URL input (optional, for reference) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  {componentEditor.datasheet && componentEditor.datasheet.trim() ? (
                    <a
                      href={componentEditor.datasheet.trim().match(/^https?:\/\//) ? componentEditor.datasheet.trim() : `https://${componentEditor.datasheet.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: '#0066cc', textDecoration: 'underline', cursor: 'pointer', flex: '0 0 auto' }}
                      title="Open datasheet URL"
                    >
                      {componentEditor.datasheet.trim()}
                    </a>
                  ) : null}
                  <input
                    id={`component-datasheet-${comp.id}`} 
                    type="text"
                    value={componentEditor.datasheet || ''} 
                    onChange={(e) => setComponentEditor({ ...componentEditor, datasheet: e.target.value })} 
                    disabled={areComponentsLocked}
                    placeholder="Enter datasheet URL (optional)"
                    style={{ 
                      flex: 1, 
                      minWidth: '200px',
                      padding: '2px 6px', 
                      fontSize: '11px', 
                      border: '1px solid #ddd', 
                      borderRadius: 2, 
                      background: '#fff', 
                      color: '#000',
                      opacity: areComponentsLocked ? 0.6 : 1
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* IC Properties section - Pin Count, Manufacturer, Part Number for Integrated Circuits */}
            {(comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') && (
              <>
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0', fontSize: '11px', fontWeight: 600, color: '#000', marginBottom: '4px' }}>IC Properties:</div>
                
                {/* Pin Count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <label htmlFor={`component-pincount-ic-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                    Pin Count:
                  </label>
                  <input
                    id={`component-pincount-ic-${comp.id}`}
                    name={`component-pincount-ic-${comp.id}`}
                    type="number"
                    min="1"
                    value={componentEditor.pinCount}
                    onChange={(e) => {
                      const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                      setComponentEditor({ ...componentEditor, pinCount: newPinCount });
                    }}
                    onBlur={(e) => {
                      if (areComponentsLocked) {
                        alert('Cannot edit: Components are locked. Unlock components to edit them.');
                        return;
                      }
                      const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                      const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                      const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                      if (currentComp && newPinCount !== currentComp.pinCount) {
                        const currentConnections = currentComp.pinConnections || [];
                        const newPinConnections = new Array(newPinCount).fill('').map((_, i) => 
                          i < currentConnections.length ? currentConnections[i] : ''
                        );
                        const currentPolarities = currentComp.pinPolarities || [];
                        const newPinPolarities = currentComp.pinPolarities ? new Array(newPinCount).fill('').map((_, i) => 
                          i < currentPolarities.length ? currentPolarities[i] : ''
                        ) : undefined;
                        const updatedComp = {
                          ...currentComp,
                          pinCount: newPinCount,
                          pinConnections: newPinConnections,
                          ...(newPinPolarities !== undefined && { pinPolarities: newPinPolarities }),
                        };
                        if (componentEditor.layer === 'top') {
                          setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                        } else {
                          setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                        }
                        setComponentEditor({ ...componentEditor, pinCount: newPinCount });
                      }
                    }}
                    disabled={areComponentsLocked}
                    style={{ width: '80px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
                  />
                </div>
                
                {/* Manufacturer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <label htmlFor={`component-manufacturer-ic-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                    Manufacturer:
                  </label>
                  <input
                    id={`component-manufacturer-ic-${comp.id}`}
                    type="text"
                    value={componentEditor.manufacturer || ''}
                    onChange={(e) => setComponentEditor({ ...componentEditor, manufacturer: e.target.value })}
                    disabled={areComponentsLocked}
                    style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
                    placeholder="e.g., Texas Instruments"
                  />
                </div>
                
                {/* Part Number */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <label htmlFor={`component-partnumber-ic-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
                    Part Number:
                  </label>
                  <input
                    id={`component-partnumber-ic-${comp.id}`}
                    type="text"
                    value={componentEditor.partNumber || ''}
                    onChange={(e) => setComponentEditor({ ...componentEditor, partNumber: e.target.value })}
                    disabled={areComponentsLocked}
                    style={{ width: '150px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
                    placeholder="e.g., LM358"
                  />
                </div>
              </>
            )}
            
            {/* Gemini API Key and Extract button - right below datasheet */}
            {((comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor')) && (
              <div style={{ marginBottom: '8px', padding: '4px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '3px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
                    <span
                      onClick={() => setShowApiKeyInstructions(true)}
                      style={{
                        color: '#0066cc',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                      title="Click for instructions on how to get an API key"
                    >
                      Google Gemini API Key
                    </span>
                    {' '}(to extract information from the Datasheet):
                  </label>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      style={{
                        flex: 1,
                        minWidth: '200px',
                        padding: '3px 6px',
                        fontSize: '11px',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        background: '#fff',
                        color: '#000'
                      }}
                      title="Enter your Google Gemini API key. Get one free at https://aistudio.google.com/apikey"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: '#2196F3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Save API Key
                    </button>
                    <button
                      onClick={handleFetchPinNames}
                      disabled={isFetchingPinNames || areComponentsLocked}
                      className={isFetchingPinNames ? 'fetch-pin-names-pulse' : ''}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: areComponentsLocked ? '#ccc' : '#4CAF50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: isFetchingPinNames || areComponentsLocked ? 'not-allowed' : 'pointer',
                        opacity: areComponentsLocked ? 0.6 : 1,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        transition: 'background 0.2s'
                      }}
                    >
                      {isFetchingPinNames ? 'Extracting...' : 'Extract Datasheet Information'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Type-specific value fields - moved near top for easy access */}
        <ComponentTypeFields
            component={comp}
            componentEditor={componentEditor}
            componentDefinition={componentDefinition}
          setComponentEditor={setComponentEditor}
          areComponentsLocked={areComponentsLocked}
          componentsTop={componentsTop}
          componentsBottom={componentsBottom}
          uploadedDatasheetFile={uploadedDatasheetFile}
          setUploadedDatasheetFile={setUploadedDatasheetFile}
          setComponentsTop={setComponentsTop}
          setComponentsBottom={setComponentsBottom}
        />
        
        {/* Designator - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0' }}>
          <label htmlFor={`component-designator-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Designator:
          </label>
          <input
            id={`component-designator-${comp.id}`}
            name={`component-designator-${comp.id}`}
            type="text"
            value={componentEditor.designator || ''}
            onChange={(e) => {
              const val = e.target.value;
              // Extract abbreviation (first letter) from designator for display purposes
              const newAbbreviation = val.length > 0 ? val.charAt(0).toUpperCase() : componentEditor.abbreviation;
              setComponentEditor({ ...componentEditor, designator: val, abbreviation: newAbbreviation });
            }}
            disabled={areComponentsLocked}
            style={{ width: '80px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', fontFamily: 'monospace', textTransform: 'uppercase', opacity: areComponentsLocked ? 0.6 : 1 }}
            placeholder="e.g., U2, R7, C1"
          />
        </div>
        
        {/* Description/Part Name - for all components */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-description-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Description:
          </label>
          <input
            id={`component-description-${comp.id}`}
            name={`component-description-${comp.id}`}
            type="text"
            value={componentEditor.description || ''}
            onChange={(e) => {
              // Description is always separate from designator for all component types
              setComponentEditor({ ...componentEditor, description: e.target.value });
            }}
            disabled={areComponentsLocked}
            style={{ width: '180px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
            placeholder=""
          />
        </div>
        
        {/* Notes - single line, clickable to open Notes dialog */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-notes-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Notes:
          </label>
          <input
            id={`component-notes-${comp.id}`}
            name={`component-notes-${comp.id}`}
            type="text"
            readOnly
            value={comp.notes || ''}
            onClick={() => {
              if (!areComponentsLocked) {
                // Select this component and open Notes dialog
                setSelectedComponentIds(new Set([comp.id]));
                setNotesDialogVisible(true);
              }
            }}
            disabled={areComponentsLocked}
            style={{ 
              width: '180px', 
              padding: '2px 3px', 
              background: '#f5f5f5', 
              border: '1px solid #ddd', 
              borderRadius: 2, 
              fontSize: '11px', 
              color: '#000', 
              opacity: areComponentsLocked ? 0.6 : 1,
              cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            placeholder="Click to edit notes..."
            title={comp.notes || 'Click to edit notes...'}
          />
        </div>
        
        {/* Pin Count - on one line (for all components) */}
        {comp.componentType !== 'IntegratedCircuit' && (comp as any).componentType !== 'Semiconductor' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-pincount-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
              Pin Count:
            </label>
            <input
              id={`component-pincount-${comp.id}`}
              name={`component-pincount-${comp.id}`}
              type="number"
              min="1"
              value={componentEditor.pinCount}
              onChange={(e) => {
                const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                setComponentEditor({ ...componentEditor, pinCount: newPinCount });
              }}
              onBlur={(e) => {
                if (areComponentsLocked) {
                  alert('Cannot edit: Components are locked. Unlock components to edit them.');
                  return;
                }
                const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                if (currentComp && newPinCount !== currentComp.pinCount) {
                  const currentConnections = currentComp.pinConnections || [];
                  const newPinConnections = new Array(newPinCount).fill('').map((_, i) => 
                    i < currentConnections.length ? currentConnections[i] : ''
                  );
                  const currentPolarities = currentComp.pinPolarities || [];
                  const newPinPolarities = currentComp.pinPolarities ? new Array(newPinCount).fill('').map((_, i) => 
                    i < currentPolarities.length ? currentPolarities[i] : ''
                  ) : undefined;
                  const updatedComp = {
                    ...currentComp,
                    pinCount: newPinCount,
                    pinConnections: newPinConnections,
                    ...(newPinPolarities !== undefined && { pinPolarities: newPinPolarities }),
                  };
                  if (componentEditor.layer === 'top') {
                    setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  } else {
                    setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                  }
                  setComponentEditor({ ...componentEditor, pinCount: newPinCount });
                }
              }}
              disabled={areComponentsLocked}
              style={{ width: '60px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
            />
          </div>
        )}
        
        {/* X - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-x-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            X:
          </label>
          <input
            id={`component-x-${comp.id}`}
            name={`component-x-${comp.id}`}
            type="number"
            value={componentEditor.x.toFixed(2)}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setComponentEditor({ ...componentEditor, x: val });
            }}
            disabled={areComponentsLocked}
            style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          />
        </div>
        
        {/* Y - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor={`component-y-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
            Y:
          </label>
          <input
            id={`component-y-${comp.id}`}
            name={`component-y-${comp.id}`}
            type="number"
            value={componentEditor.y.toFixed(2)}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setComponentEditor({ ...componentEditor, y: val });
            }}
            disabled={areComponentsLocked}
            style={{ width: '90px', padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '11px', color: '#000', opacity: areComponentsLocked ? 0.6 : 1 }}
          />
        </div>
        
        {/* Pin Connections - tabular format with polarity column for components with polarity */}
        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
            Pin Connections:
          </label>
          {connectingPin && connectingPin.componentId === comp.id && (
            <div style={{ padding: '2px 3px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 2, marginBottom: '2px', fontSize: '11px', color: '#856404' }}>
              Pin {connectingPin.pinIndex + 1} selected. Click on a via or pad to connect.
            </div>
          )}
          {(() => {
            // Determine if this component type has polarity using definition
            const showPolarityColumn = isComponentPolarized(comp);
            
            // Get pin names from component instance (user-editable) or definition (defaults)
            const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
            const currentComp = currentCompList.find(c => c.id === componentEditor.id);
            const instancePinNames = (currentComp as any)?.pinNames as string[] | undefined;
            // Resolve definition if not provided as prop
            const resolvedDef = componentDefinition || resolveComponentDefinition(comp as any);
            const definitionPinNames = resolvedDef?.properties?.pinNames as string[] | undefined;
            
            // Data-driven: Show Name column if pinNames are defined in the definition
            // If pinNames contains "CHIP_DEPENDENT", use text input (for ICs with custom pin names)
            // Otherwise, use dropdown (for transistors, op amps with predefined names)
            const hasPinNames = definitionPinNames && definitionPinNames.length > 0;
            const isChipDependent = hasPinNames && definitionPinNames.includes('CHIP_DEPENDENT');
            const useDropdown = hasPinNames && !isChipDependent; // Dropdown for predefined names
            const useTextInput = isChipDependent; // Text input for CHIP_DEPENDENT
            const showNameColumn = hasPinNames; // Show if pinNames are defined

            return (
              <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '2px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd', background: '#f5f5f5' }}>
                    <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333', width: '20px' }}></th>
                    <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333', width: '40px' }}>Pin</th>
                    {showNameColumn && (
                      <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333', width: '70px' }}>Pin Name</th>
                    )}
                    {showPolarityColumn && (
                      <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333', width: '50px' }}>Polarity</th>
                    )}
                    <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333' }}>Node ID</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: componentEditor.pinCount }, (_, i) => {
                    const pinConnection = currentComp?.pinConnections && currentComp.pinConnections.length > i ? currentComp.pinConnections[i] : '';
                    const pinPolarity = (currentComp?.pinPolarities && currentComp.pinPolarities.length > i) ? (currentComp.pinPolarities[i] || '') : '';
                    // Get pin name from instance (user-edited) or default from definition
                    // For CHIP_DEPENDENT, show empty string (user fills in custom names)
                    const instancePinName = instancePinNames && i < instancePinNames.length ? instancePinNames[i] : '';
                    const defaultPinName = definitionPinNames && i < definitionPinNames.length ? definitionPinNames[i] : '';
                    const isChipDependent = defaultPinName === 'CHIP_DEPENDENT';
                    // Use instance value if it exists and is not empty, otherwise use default (unless it's CHIP_DEPENDENT)
                    const currentPinName = (instancePinName && instancePinName.trim() !== '') ? instancePinName : 
                                          (isChipDependent ? '' : defaultPinName);
                    const isSelected = connectingPin && connectingPin.componentId === comp.id && connectingPin.pinIndex === i;
                    
                    return (
                      <tr
                        key={i}
                        style={{
                          cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                          background: isSelected ? '#e6f0ff' : pinConnection ? '#d4edda' : '#fff',
                          borderBottom: '1px solid #eee',
                        }}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName === 'SELECT') {
                            return;
                          }
                          if (areComponentsLocked) {
                            alert('Cannot edit: Components are locked. Unlock components to edit them.');
                            return;
                          }
                          if (isSelected) {
                            setConnectingPin(null);
                          } else {
                            setConnectingPin({ componentId: comp.id, pinIndex: i });
                          }
                        }}
                        title={pinConnection ? `Connected to: ${pinConnection}` : 'Select this pin, then click on a via or pad to connect'}
                      >
                        <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                          <input
                            id={`pin-radio-${comp.id}-${i}`}
                            name={`pin-radio-${comp.id}`}
                            type="radio"
                            checked={!!isSelected}
                            onChange={() => {
                              if (areComponentsLocked) {
                                alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                return;
                              }
                              if (isSelected) {
                                setConnectingPin(null);
                              } else {
                                setConnectingPin({ componentId: comp.id, pinIndex: i });
                              }
                            }}
                            disabled={areComponentsLocked}
                            style={{ margin: 0, cursor: areComponentsLocked ? 'not-allowed' : 'pointer', opacity: areComponentsLocked ? 0.6 : 1, width: '10px', height: '10px' }}
                          />
                        </td>
                        <td style={{ padding: '2px 4px', color: '#333', fontWeight: isSelected ? 600 : 400, fontFamily: 'monospace' }}>
                          {i + 1}
                        </td>
                        {(useDropdown || useTextInput) && (
                          <td style={{ padding: '2px 4px', textAlign: 'left' }}>
                            {useDropdown ? (
                              // Transistor/Op Amp: Dropdown that displays and allows editing the pin name
                              <select
                                value={currentPinName || ''}
                                onChange={(e) => {
                                  if (areComponentsLocked) {
                                    alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                    return;
                                  }
                                  const newPinName = e.target.value;
                                  const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                                  const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                                  if (currentComp) {
                                    const existingPinNames = (currentComp as any).pinNames || 
                                                             (definitionPinNames ? [...definitionPinNames] : []);
                                    const newPinNames = [...existingPinNames];
                                    while (newPinNames.length < componentEditor.pinCount) {
                                      newPinNames.push('');
                                    }
                                    newPinNames[i] = newPinName;
                                    const updatedComp = { ...currentComp, pinNames: newPinNames };
                                    if (componentEditor.layer === 'top') {
                                      setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    } else {
                                      setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    }
                                  }
                                }}
                                disabled={areComponentsLocked}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                style={{ 
                                  padding: '2px 4px', 
                                  fontSize: '11px', 
                                  border: '1px solid #ddd', 
                                  borderRadius: 2, 
                                  background: '#fff',
                                  color: '#333',
                                  cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                                  opacity: areComponentsLocked ? 0.6 : 1,
                                  width: '100%',
                                  fontStyle: 'italic',
                                  minHeight: '18px'
                                }}
                              >
                                {definitionPinNames && definitionPinNames.length > 0 ? (
                                  // Filter out CHIP_DEPENDENT from dropdown options (it's only used as a marker)
                                  definitionPinNames.filter(name => name !== 'CHIP_DEPENDENT').map((name, idx) => (
                                    <option key={idx} value={name}>{name}</option>
                                  ))
                                ) : (
                                  <option value="">-</option>
                                )}
                              </select>
                            ) : (
                              // IC: Text input field
                              <input
                                type="text"
                                value={currentPinName || ''}
                                onChange={(e) => {
                                  if (areComponentsLocked) {
                                    alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                    return;
                                  }
                                  const newPinName = e.target.value;
                                  const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                                  const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                                  if (currentComp) {
                                    const existingPinNames = (currentComp as any).pinNames || [];
                                    const newPinNames = [...existingPinNames];
                                    while (newPinNames.length < componentEditor.pinCount) {
                                      newPinNames.push('');
                                    }
                                    newPinNames[i] = newPinName;
                                    const updatedComp = { ...currentComp, pinNames: newPinNames };
                                    if (componentEditor.layer === 'top') {
                                      setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    } else {
                                      setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                    }
                                  }
                                }}
                                disabled={areComponentsLocked}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                placeholder="Pin name"
                                style={{ 
                                  padding: '1px 2px', 
                                  fontSize: '11px', 
                                  border: '1px solid #ddd', 
                                  borderRadius: 2, 
                                  background: '#fff',
                                  color: '#333',
                                  width: '100%',
                                  opacity: areComponentsLocked ? 0.6 : 1,
                                  cursor: areComponentsLocked ? 'not-allowed' : 'text'
                                }}
                              />
                            )}
                          </td>
                        )}
                        {showPolarityColumn && (
                          <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                            {pinConnection ? (
                              // Display polarity as read-only text when connected (like Information dialog)
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                color: pinPolarity === '+' ? '#d32f2f' : pinPolarity === '-' ? '#1976d2' : '#999'
                              }}>
                                {pinPolarity || '-'}
                              </span>
                            ) : (
                              // Allow editing polarity when not connected
                            <select
                              key={`polarity-${comp.id}-${i}-${pinPolarity}`}
                              value={pinPolarity ?? ''}
                              onChange={(e) => {
                                if (areComponentsLocked) {
                                  alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                  return;
                                }
                                const newPolarity = e.target.value as '+' | '-' | '';
                                const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                                const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                                if (currentComp) {
                                  const existingPolarities = currentComp.pinPolarities || new Array(currentComp.pinCount).fill('');
                                  const newPolarities = [...existingPolarities];
                                  while (newPolarities.length < currentComp.pinCount) {
                                    newPolarities.push('');
                                  }
                                  newPolarities[i] = newPolarity;
                                  const updatedComp = { ...currentComp, pinPolarities: newPolarities };
                                  if (componentEditor.layer === 'top') {
                                    setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                  } else {
                                    setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                                  }
                                }
                              }}
                              disabled={areComponentsLocked}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.stopPropagation()}
                              style={{ 
                                padding: '1px 2px', 
                                fontSize: '11px', 
                                border: '1px solid #ddd', 
                                borderRadius: 2, 
                                background: '#fff',
                                cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                                opacity: areComponentsLocked ? 0.6 : 1,
                                width: '100%',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                              }}
                            >
                              <option value="">-</option>
                              <option value="+">+</option>
                              <option value="-">-</option>
                            </select>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '2px 4px', color: pinConnection ? '#28a745' : '#999', fontWeight: pinConnection ? 600 : 400, fontFamily: 'monospace' }}>
                          {pinConnection || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Fixed footer with buttons */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '6px',
        padding: '6px',
        borderTop: '1px solid #e0e0e0',
        flexShrink: 0,
      }}>
        <button
          onClick={() => {
            setComponentEditor(null);
            setConnectingPin(null); // Clear pin connection mode
          }}
          disabled={areComponentsLocked}
          style={{
            padding: '2px 5px',
            background: areComponentsLocked ? '#f5f5f5' : '#fff',
            color: areComponentsLocked ? '#999' : '#333',
            border: '1px solid #ddd',
            borderRadius: 2,
            cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: areComponentsLocked ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={areComponentsLocked}
          style={{
            padding: '2px 5px',
            background: areComponentsLocked ? '#f5f5f5' : '#0b5fff',
            color: areComponentsLocked ? '#999' : '#fff',
            border: '1px solid #ddd',
            borderRadius: 2,
            cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: areComponentsLocked ? 0.6 : 1,
          }}
        >
          Save
        </button>
      </div>
      
      {/* API Key Instructions Dialog */}
      {showApiKeyInstructions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10005,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowApiKeyInstructions(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '400px',
              maxWidth: '600px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
                How to Get a Google Gemini API Key
              </h3>
              <button
                onClick={() => setShowApiKeyInstructions(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: 0,
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: '20px', color: '#ddd', fontSize: '14px', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 12px 0' }}>
                To get a Google Gemini API key, go to{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4CAF50', textDecoration: 'underline' }}
                >
                  Google AI Studio (aistudio.google.com/app/apikey)
                </a>
                , sign in with your Google account, and click "Get API key" or "Create API key" in the Dashboard to generate a key for a new or existing Google Cloud project, then copy it and store it securely.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowApiKeyInstructions(false)}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: '1px solid #45a049',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '20px',
          height: '20px',
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 0%, transparent 40%, #ccc 40%, #ccc 45%, transparent 45%, transparent 55%, #ccc 55%, #ccc 60%, transparent 60%)',
          zIndex: 1001,
        }}
        title="Drag to resize"
      />
    </div>
    
    <InfoDialog
      visible={infoDialog.visible}
      title={infoDialog.title}
      message={infoDialog.message}
      type={infoDialog.type}
      onClose={() => setInfoDialog({ visible: false, title: '', message: '', type: 'info' })}
    />
    </>
  );
};

