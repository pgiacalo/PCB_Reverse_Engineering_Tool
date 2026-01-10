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
 * ComponentEditor component
 * Dialog for editing component properties
 */

import React, { useState, useEffect } from 'react';
import type { PCBComponent } from '../../types';
import type { ComponentDefinition, ComponentFieldDefinition } from '../../data/componentDefinitions.d';
import { InfoDialog } from '../InfoDialog/InfoDialog';
import { COMPONENT_TYPE_INFO, formatComponentTypeName } from '../../constants';
import { ComponentTypeFields } from './ComponentTypeFields';
import { resolveComponentDefinition } from '../../utils/componentDefinitionResolver';
import { isComponentPolarized } from '../../utils/components';
import { getAIPrompt } from '../../utils/aiPrompts';

// AI Service configuration - supports multiple providers (Gemini, Claude)
// API keys are stored in user-selected storage (sessionStorage or localStorage)
// This ensures no API key is exposed in production builds
import {
  getCurrentService,
  getAIConfig,
  saveAIConfig,
  setCurrentProvider,
  getApiKeyStorageType,
  setApiKeyStorageType,
  migrateFromLegacyStorage,
  AVAILABLE_PROVIDERS,
  SERVICE_INFO,
  type AIServiceProvider,
  type APIKeyStorageType,
  type AIService,
} from '../../utils/aiServices';
import { geminiService } from '../../utils/aiServices/gemini';
import { claudeService } from '../../utils/aiServices/claude';

// Run migration on module load to preserve any existing Gemini API keys
// Wrap in try-catch to prevent crashes if storage is corrupted
  if (typeof window !== 'undefined') {
  try {
    migrateFromLegacyStorage();
  } catch (error) {
    console.warn('Failed to run storage migration:', error);
  }
}

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
  /** Project directory handle for accessing files */
  projectDirHandle: FileSystemDirectoryHandle | null;
  /** External trigger to show AI settings dialog */
  showAiSettingsDialog?: boolean;
  /** Callback when AI settings dialog is closed */
  onAiSettingsDialogClose?: () => void;
  /** Callback to find and center on a component */
  onFindComponent?: (componentId: string, x: number, y: number) => void;
  /** Canvas height for syncing dialog height */
  canvasHeight?: number;
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
  projectDirHandle,
  showAiSettingsDialog = false,
  onAiSettingsDialogClose,
  onFindComponent,
  canvasHeight,
}) => {
  const [isFetchingPinNames, setIsFetchingPinNames] = useState(false);
  const [uploadedDatasheetFile, setUploadedDatasheetFile] = useState<File | null>(null);
  const [showApiKeyInstructions, setShowApiKeyInstructions] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  // AI Service state - supports multiple providers
  const [selectedProvider, setSelectedProvider] = useState<AIServiceProvider>(() => {
    if (typeof window !== 'undefined') {
      try {
        return getAIConfig().provider;
      } catch (error) {
        console.warn('Failed to load provider from config:', error);
        return 'gemini';
      }
    }
    return 'gemini';
  });
  
  // API key input state - must be at top level (React Rules of Hooks)
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const service = getCurrentService();
        return service.getApiKey() || '';
      } catch (error) {
        console.warn('Failed to load API key:', error);
        return '';
      }
    }
    return '';
  });
  
  // Model selection state
  const [modelInput, setModelInput] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const service = getCurrentService();
        return service.getModel();
      } catch (error) {
        console.warn('Failed to load model:', error);
        return 'gemini-2.0-flash';
      }
    }
    return 'gemini-2.0-flash';
  });
  
  // API key storage type (sessionStorage or localStorage)
  const [storageType, setStorageType] = useState<APIKeyStorageType>(() => {
    if (typeof window !== 'undefined') {
      try {
        return getApiKeyStorageType();
      } catch (error) {
        console.warn('Failed to load storage type:', error);
        return 'localStorage';
      }
    }
    return 'localStorage';
  });
  
  // Check if API key exists for current provider (for Remove button state)
  const [hasStoredApiKey, setHasStoredApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return getCurrentService().hasApiKey();
      } catch (error) {
        console.warn('Failed to check for stored API key:', error);
        return false;
      }
    }
    return false;
  });

  // Handle external trigger to show AI settings dialog
  useEffect(() => {
    if (showAiSettingsDialog) {
      // Reload all settings when dialog opens
      if (typeof window !== 'undefined') {
        try {
          const config = getAIConfig();
          setSelectedProvider(config.provider);
          setStorageType(config.apiKeyStorageType);
          
          const service = getCurrentService();
          const savedKey = service.getApiKey();
          const savedModel = service.getModel();
          
          setApiKeyInput(savedKey || '');
          setModelInput(savedModel);
          setHasStoredApiKey(!!savedKey);
        } catch (error) {
          // If loading settings fails, use defaults and show dialog anyway
          console.warn('Failed to load AI settings:', error);
          setSelectedProvider('gemini');
          setStorageType('localStorage');
          setApiKeyInput('');
          setModelInput('gemini-2.0-flash');
          setHasStoredApiKey(false);
        }
      }
      // Use a small timeout to ensure state updates properly
      const timer = setTimeout(() => {
        setShowApiKeyDialog(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showAiSettingsDialog]);
  
  // Handle provider changes - load API key and model for the selected provider
  useEffect(() => {
    if (showApiKeyDialog && typeof window !== 'undefined') {
      try {
        // Get the service registry
        const services: Record<AIServiceProvider, AIService> = {
          gemini: geminiService,
          claude: claudeService,
        };
        
        const service = services[selectedProvider];
        if (service) {
          const savedKey = service.getApiKey();
          const savedModel = service.getModel();
          
          setApiKeyInput(savedKey || '');
          setModelInput(savedModel);
          setHasStoredApiKey(!!savedKey);
        }
      } catch (error) {
        console.warn('Failed to load settings for provider:', selectedProvider, error);
      }
    }
  }, [selectedProvider, showApiKeyDialog]);

  // Update hasStoredApiKey when provider changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const service = getCurrentService();
        setHasStoredApiKey(service.hasApiKey() || !!apiKeyInput.trim());
      } catch (error) {
        console.warn('Failed to check API key status:', error);
        setHasStoredApiKey(!!apiKeyInput.trim());
      }
    }
  }, [apiKeyInput, selectedProvider]);

  // Load custom prompt from component when editor opens
  useEffect(() => {
    if (componentEditor) {
      const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
      const currentComp = currentCompList.find(c => c.id === componentEditor.id);
      if (currentComp) {
        const customPromptValue = (currentComp as any).componentPropertiesAIPrompt;
        if (customPromptValue) {
          setCustomPrompt(customPromptValue);
        } else {
          setCustomPrompt(''); // Reset to empty if no custom prompt
        }
      }
    }
  }, [componentEditor?.id, componentsTop, componentsBottom]); // Reload when component ID changes

  // Function to save API key, model, and settings - moved to top level (before early return)
  const handleSaveApiKey = () => {
      if (typeof window !== 'undefined') {
      // CRITICAL: Save the provider and storage type preference FIRST
      // This ensures getApiKey() reads from the correct storage
      saveAIConfig({
        provider: selectedProvider,
        model: modelInput,
        apiKeyStorageType: storageType,
      });
      setApiKeyStorageType(storageType);
      setCurrentProvider(selectedProvider);
      
      // Get the service registry (need direct access to ensure we use the right provider)
      const services: Record<AIServiceProvider, AIService> = {
        gemini: geminiService,
        claude: claudeService,
      };
      const service = services[selectedProvider];
      const serviceInfo = SERVICE_INFO[selectedProvider];
      
      if (apiKeyInput.trim()) {
        service.saveApiKey(apiKeyInput.trim(), storageType);
        service.saveModel(modelInput);
      setHasStoredApiKey(true);
        
        const storageNote = storageType === 'sessionStorage' 
          ? 'Note: The API key will be cleared when you close the browser tab.'
          : 'Note: The API key will persist until you remove it.';
        
      setInfoDialog({
        visible: true,
          title: 'Settings Saved',
          message: `${serviceInfo.name} API key and model (${modelInput}) saved! You can now use the "Extract Datasheet Information" feature. ${storageNote}`,
        type: 'success',
      });
    } else {
        service.removeApiKey();
        service.saveModel(modelInput); // Still save model even if removing key
      setHasStoredApiKey(false);
      setInfoDialog({
        visible: true,
        title: 'API Key Removed',
        message: 'API key removed. Model preference saved.',
        type: 'info',
      });
      }
    }
  };

  // Function to remove API key
  const handleRemoveApiKey = () => {
    if (typeof window !== 'undefined') {
      const service = getCurrentService();
      service.removeApiKey();
    }
    setApiKeyInput(''); // Clear the input field
    setHasStoredApiKey(false); // Update state
    setInfoDialog({
      visible: true,
      title: 'API Key Removed',
      message: 'API key has been removed. You will need to enter it again to use AI features.',
      type: 'info',
    });
  };
  
  // Function to handle provider change
  const handleProviderChange = (provider: AIServiceProvider) => {
    setSelectedProvider(provider);
    setCurrentProvider(provider);
    
    // Load the API key and model for the new provider
    const service = getCurrentService();
    setApiKeyInput(service.getApiKey() || '');
    setModelInput(service.getModel());
    setHasStoredApiKey(service.hasApiKey());
  };

  // Function to find components by designator
  const handleFindByDesignator = () => {
    const designatorToFind = componentEditor?.designator?.trim().toUpperCase();
    if (!designatorToFind) {
      return;
    }

    // Search for all components with matching designator (case-insensitive)
    const allComponents = [...componentsTop, ...componentsBottom];
    const matchingComponents = allComponents.filter(
      c => c.designator?.trim().toUpperCase() === designatorToFind
    );

    if (matchingComponents.length === 0) {
      return;
    }

    // Center on the first matching component (like the Information dialog Find button)
    // This will also select the first component, but we'll override to select all matches
    if (onFindComponent && matchingComponents.length > 0) {
      const firstComponent = matchingComponents[0];
      onFindComponent(firstComponent.id, firstComponent.x, firstComponent.y);
    }

    // Select all matching components (override the single selection from onFindComponent)
    const matchingIds = new Set(matchingComponents.map(c => c.id));
    setSelectedComponentIds(matchingIds);
  };

  // Fallback function to build a generic default prompt dynamically based on component fields
  // This is used only when no named prompt (aiPromptName) or inline prompt (aiPrompt) is available
  // In the future, this could be replaced with a generic template prompt in aiPrompts.json
  const buildDefaultPrompt = (fieldsToExtract: Array<{
    name: string;
    label: string;
    type: string;
    hasUnits: boolean;
    units: string[];
  }>): string => {
    return `You are analyzing an electronic component datasheet PDF. Extract pin information, component properties, a datasheet summary, IC type, and pin count, then return the data as a JSON object.

Requirements:
1. Return a JSON object with three sections: "pins", "properties", and "summary"
2. First, determine the total number of pins (pinCount) for this component from the datasheet. This should be a positive integer representing the total number of pins/pads on the component.
3. For pins, extract information for ALL pins found in the datasheet (not just a subset). For each pin, provide:
   - pinNumber: The pin number (1, 2, 3, etc.)
   - pinName: The signal name (e.g., VCC, GND, IN+, OUT, etc.). Use the exact name from the datasheet.
   - pinDescription: A brief description of the pin's function (optional, can be empty string)
   - pinType: The pin type (optional): "input", "output", "bidirectional", "power", "ground", "no_connect", or "passive". Only include if clearly identifiable from the datasheet.
   - alternateFunctions: An array of alternate function names for this pin (optional, only if the pin has multiple functions). For example, a microcontroller GPIO pin might have ["SPI_MOSI", "I2C_SDA"] as alternate functions.
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
5. For IC Type (icType), determine the type of integrated circuit from the datasheet. Choose from: "BJT NPN", "BJT PNP", "MOSFET N-Channel", "MOSFET P-Channel", "JFET", "Op-Amp", "Microcontroller", "Microprocessor", "Logic", "Memory", "Voltage Regulator", "Timer", "ADC", "DAC", "Comparator", "Transceiver", "Driver", "Amplifier", or "Other". If it's clearly an op amp, use "Op-Amp". If it's clearly a microcontroller, use "Microcontroller", etc.
6. For Package Type (packageType), determine the package type from the datasheet. Choose from: "DIP", "PDIP", "SOIC", "QFP", "LQFP", "TQFP", "BGA", "SSOP", "TSOP", "Various", or "Other". If multiple package types are mentioned in the datasheet, use "Various". If it's a plastic DIP, use "PDIP". If it's a standard DIP, use "DIP".
7. For pin count (pinCount), determine the total number of pins/pads on the component from the datasheet. This should be a positive integer. Include this in the properties section.
8. For datasheet summary (datasheetSummary), provide a concise summary (2-4 sentences) of the introductory information from the datasheet, including what the component is, its main purpose, and key features mentioned in the introduction or overview section.
9. Only include properties that are actually found in the datasheet - do not make up values
10. For numeric fields with units, extract both the numeric value and the appropriate unit
11. Return ONLY valid JSON, no additional text, explanations, or markdown formatting

Example JSON format:
{
  "pins": [
    {"pinNumber": 1, "pinName": "VCC", "pinDescription": "Power supply positive", "pinType": "power"},
    {"pinNumber": 2, "pinName": "GND", "pinDescription": "Ground", "pinType": "ground"},
    {"pinNumber": 3, "pinName": "IN+", "pinDescription": "Non-inverting input", "pinType": "input"},
    {"pinNumber": 4, "pinName": "IN-", "pinDescription": "Inverting input", "pinType": "input"},
    {"pinNumber": 5, "pinName": "OUT", "pinDescription": "Output", "pinType": "output"},
    {"pinNumber": 6, "pinName": "GPIO1", "pinDescription": "General purpose I/O", "pinType": "bidirectional", "alternateFunctions": ["SPI_MOSI", "I2C_SDA"]}
  ],
  "properties": {
    "partNumber": "LM358",
    "manufacturer": "Texas Instruments",
    "voltage": 36,
    "voltageUnit": "V",
    "description": "Dual operational amplifier",
    "icType": "Op-Amp",
    "packageType": "PDIP",
    "pinCount": 5
  },
  "summary": {
    "datasheetSummary": "The LM358 is a dual operational amplifier featuring low power consumption and wide supply voltage range. It is designed for single supply operation from 3V to 32V or dual supplies from ±1.5V to ±16V. The device offers high gain bandwidth product and low input offset voltage."
  }
}

Analyze the attached PDF datasheet and extract the information according to the requirements above.`;
  };
  
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
  const [infoDialog, setInfoDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'success';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
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
      // Set uploadedDatasheetFile to null since we don't have the actual File object
      // The file will be loaded from project directory when needed
        setUploadedDatasheetFile(null);
      // Always restore file path from component data to componentEditor
      // This ensures the path is available for display and file opening
      if (componentEditor) {
        setComponentEditor({
          ...componentEditor,
          datasheetFileName: ic.datasheetFileName || undefined,
        });
      }
    } else {
      setUploadedDatasheetFile(null);
    }
  }, [comp?.id, comp?.componentType, (comp as any)?.datasheetFileName]);
  
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

  // Sync dialog height with canvas height when canvas size changes
  useEffect(() => {
    if (canvasHeight && canvasHeight > 200) {
      setDialogSize((prev: { width: number; height: number }) => {
        const newSize = { ...prev, height: canvasHeight };
        localStorage.setItem('componentDialogSize', JSON.stringify(newSize));
        return newSize;
      });
    }
  }, [canvasHeight]);

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
  // Render dialogs even when no component is being edited (for Settings menu access)
  if (!componentEditor || !componentEditor.visible) {
    return (
      <>
        {/* AI Settings Dialog - shown when user tries to extract without API key or from Settings menu */}
        {showApiKeyDialog && (
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
                setShowApiKeyDialog(false);
                onAiSettingsDialogClose?.();
              }
            }}
          >
            <div
              style={{
                backgroundColor: '#2b2b31',
                borderRadius: 8,
                padding: '24px',
                minWidth: '520px',
                maxWidth: '620px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                border: '1px solid #1f1f24',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
                  AI Service Configuration
                </h3>
                <button
                  onClick={() => {
                    setShowApiKeyDialog(false);
                    onAiSettingsDialogClose?.();
                  }}
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
                {/* AI Service Provider Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                    AI Service Provider:
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value as AIServiceProvider)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      background: '#1f1f24',
                      color: '#fff',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {AVAILABLE_PROVIDERS.map(provider => (
                      <option key={provider} value={provider}>
                        {SERVICE_INFO[provider].name}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '6px 0 0 0', color: '#aaa', fontSize: '12px', lineHeight: '1.4' }}>
                    {SERVICE_INFO[selectedProvider].description}
                  </p>
                </div>
                
                {/* API Key Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                    {SERVICE_INFO[selectedProvider].name} API Key:
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={SERVICE_INFO[selectedProvider].apiKeyPlaceholder}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      background: '#1f1f24',
                      color: '#fff',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                  <p style={{ margin: '6px 0 0 0', color: '#aaa', fontSize: '12px' }}>
                    Get your API key from:{' '}
                    <a 
                      href={SERVICE_INFO[selectedProvider].apiKeyHelpUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#4CAF50' }}
                    >
                      {SERVICE_INFO[selectedProvider].apiKeyHelpUrl}
                    </a>
                  </p>
                </div>
                
                {/* Model Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                    Model:
                  </label>
                  <select
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      background: '#1f1f24',
                      color: '#fff',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {SERVICE_INFO[selectedProvider].models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} {model.description ? `(${model.description})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Storage Type Selection */}
                <div style={{ marginBottom: '16px', padding: '12px', background: '#1f1f24', borderRadius: '4px', border: '1px solid #444' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                    API Key Storage:
                  </label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ddd', fontSize: '13px' }}>
                      <input
                        type="radio"
                        name="storageType"
                        value="sessionStorage"
                        checked={storageType === 'sessionStorage'}
                        onChange={() => setStorageType('sessionStorage')}
                        style={{ cursor: 'pointer' }}
                      />
                      Session Storage
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ddd', fontSize: '13px' }}>
                      <input
                        type="radio"
                        name="storageType"
                        value="localStorage"
                        checked={storageType === 'localStorage'}
                        onChange={() => setStorageType('localStorage')}
                        style={{ cursor: 'pointer' }}
                      />
                      Local Storage
                    </label>
                  </div>
                  <p style={{ margin: '8px 0 0 0', color: storageType === 'sessionStorage' ? '#4CAF50' : '#ffaa00', fontSize: '12px', lineHeight: '1.4' }}>
                    {storageType === 'sessionStorage' 
                      ? '✓ Session Storage: API key is cleared when you close the browser tab (more secure)'
                      : '⚠ Local Storage: API key persists until you remove it (more convenient)'}
                  </p>
                </div>
                
                {/* Security Notes */}
                <div style={{ padding: '10px', background: '#1a1a1f', borderRadius: '4px', border: '1px solid #333' }}>
                  <p style={{ margin: '0', color: '#aaa', fontSize: '11px', lineHeight: '1.4' }}>
                    <strong style={{ color: '#ffaa00' }}>⚠️ Security:</strong> API keys are stored in plain text in browser storage and are accessible via DevTools. Do not use on shared computers. Consider using API key restrictions from your provider.
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleRemoveApiKey}
                  disabled={!hasStoredApiKey}
                  style={{
                    padding: '8px 16px',
                    background: !hasStoredApiKey ? '#444' : '#d32f2f',
                    color: '#fff',
                    border: '1px solid #666',
                    borderRadius: 6,
                    cursor: !hasStoredApiKey ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: !hasStoredApiKey ? 0.5 : 1,
                  }}
                  title={!hasStoredApiKey ? 'No API key stored' : 'Remove API key'}
                >
                  Remove Key
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setShowApiKeyDialog(false);
                    onAiSettingsDialogClose?.();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#555',
                    color: '#fff',
                    border: '1px solid #666',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleSaveApiKey();
                    setShowApiKeyDialog(false);
                    onAiSettingsDialogClose?.();
                  }}
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
                  Save Settings
                </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <InfoDialog
          visible={infoDialog.visible}
          title={infoDialog.title}
          message={infoDialog.message}
          type={infoDialog.type}
          onClose={() => {
            setInfoDialog({ visible: false, title: '', message: '', type: 'info' });
          }}
        />
      </>
    );
  }
  
  // Validate component exists and has required properties
  // NOTE: During AI extraction, the component arrays are updated, which can cause a brief moment
  // where the component isn't found. We should only close the editor if the component truly doesn't exist
  // (i.e., it's not in either array and componentEditor is still set). This prevents the editor from
  // closing during state updates.
  if (!comp && componentEditor) {
    // Double-check if component exists in either array (might be a timing issue during state updates)
    const compInTop = componentsTop.find(c => c.id === componentEditor.id);
    const compInBottom = componentsBottom.find(c => c.id === componentEditor.id);
    const compExists = compInTop || compInBottom;
    
    if (!compExists) {
    console.error('[ComponentEditor] Component not found:', { componentId: componentEditor.id, componentsTopCount: componentsTop.length, componentsBottomCount: componentsBottom.length });
      // Component was deleted - close the editor to prevent rendering errors
      setComponentEditor(null);
      return null;
    } else {
      // Component exists but useMemo didn't find it - likely a timing issue during state update
      // Don't close the editor, it will be found on next render
      console.warn('[ComponentEditor] Component exists but useMemo returned null (timing issue), waiting for next render');
      return null; // Return null to prevent rendering, but don't close editor
    }
  }
  
  // If componentEditor is null, we already returned early above, so comp should exist here
  if (!comp) {
    return null;
  }
  
  if (!comp.id || !comp.componentType || typeof comp.pinCount !== 'number') {
    console.error('[ComponentEditor] Component missing required properties:', { componentId: comp.id, hasComponentType: !!comp.componentType, componentType: comp.componentType, pinCount: comp.pinCount, pinCountType: typeof comp.pinCount, component: comp });
    return null;
  }
  
  // Note: Layer is set when the dialog opens and can be modified by the user via dropdown.
  // The actual layer change (moving component between arrays) happens on Save.

  // Update component function - handles all component type-specific save logic
  const updateComponent = (comp: PCBComponent): PCBComponent => {
    // Create a deep copy to ensure all properties are preserved, including custom ones like datasheet
    const updated = { ...comp } as any;
    console.log('[ComponentEditor] updateComponent - Entry:', {
      componentId: comp.id,
      componentType: comp.componentType,
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
    // Save manufacturer and partNumber if they exist in componentEditor
    // (These are saved specifically for IntegratedCircuit in the type-specific section below,
    // but we also save them here for other component types that might have these fields)
    if (componentEditor.manufacturer !== undefined) {
      (updated as any).manufacturer = componentEditor.manufacturer?.trim() || undefined;
    }
    if (componentEditor.partNumber !== undefined) {
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
      // Resize pinData array if it exists, preserving existing data
      if ((comp as any).pinData && Array.isArray((comp as any).pinData)) {
        const currentPinData = (comp as any).pinData as Array<{ name: string; type?: string; alternate_functions?: string[] }>;
        (updated as any).pinData = new Array(componentEditor.pinCount).fill(null).map((_, i) => 
          i < currentPinData.length && currentPinData[i] ? currentPinData[i] : { name: '' }
        );
      }
      // Also resize pinNames array for backward compatibility
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
      // Preserve existing pinData if it exists
      if ((comp as any).pinData) {
        (updated as any).pinData = (comp as any).pinData;
      }
      // Preserve existing pinNames if they exist (for backward compatibility)
      if ((comp as any).pinNames) {
        (updated as any).pinNames = (comp as any).pinNames;
      }
    }
    
    // CRITICAL: Preserve componentDefinitionKey FIRST before doing anything else
    // This ensures it's never lost, even if definition resolution fails
    if ((comp as any).componentDefinitionKey) {
      (updated as any).componentDefinitionKey = (comp as any).componentDefinitionKey;
      console.log('[ComponentEditor] Preserved componentDefinitionKey:', (comp as any).componentDefinitionKey);
    }
    
    // Get component definition to determine which fields to save
    const def: ComponentDefinition | undefined = componentDefinition || resolveComponentDefinition(comp as any);
    const fields: ComponentFieldDefinition[] | undefined = def?.fields;
    
    // Set componentDefinitionKey if we have a definition and it's not already set
    // This ensures components get the key even if they were created before the refactoring
    if (def && !(updated as any).componentDefinitionKey) {
      const defKey = `${def.category}:${def.subcategory}`;
      (updated as any).componentDefinitionKey = defKey;
      console.log('[ComponentEditor] Set componentDefinitionKey from definition:', defKey);
    } else if (!(updated as any).componentDefinitionKey) {
      console.warn('[ComponentEditor] WARNING: componentDefinitionKey not set and definition could not be resolved for component:', comp.id, comp.componentType);
    }
    
    // Update fields based on component definition (data-driven approach)
    // This replaces all hardcoded type-specific logic
    if (fields && fields.length > 0) {
      for (const field of fields) {
        const valueKey = field.name;
        const unitKey = `${field.name}Unit`;
        
        // Skip special fields that are handled elsewhere
        if (valueKey === 'datasheet' || valueKey === 'description') {
          continue;
        }
        
        // Get value from componentEditor
        const value = (componentEditor as any)[valueKey];
        
        // Handle fields with units
        if (field.units && field.units.length > 0) {
          // Save the value
          if (value !== undefined && value !== null && value !== '') {
            (updated as any)[valueKey] = String(value).trim() || undefined;
          } else {
            (updated as any)[valueKey] = undefined;
          }
          
          // Save the unit
          const unit = (componentEditor as any)[unitKey];
          if (unit !== undefined && unit !== null && unit !== '') {
            (updated as any)[unitKey] = String(unit).trim() || undefined;
          } else if (field.defaultUnit) {
            (updated as any)[unitKey] = field.defaultUnit;
          } else {
            (updated as any)[unitKey] = undefined;
          }
        } else {
          // Handle fields without units
          if (value !== undefined && value !== null && value !== '') {
            // For string fields, trim whitespace
            if (field.type === 'string') {
              (updated as any)[valueKey] = String(value).trim() || undefined;
            } else {
              (updated as any)[valueKey] = value;
            }
          } else {
            (updated as any)[valueKey] = undefined;
          }
        }
      }
    }
    
    // Special handling for description field (available for all components)
    if (componentEditor.description !== undefined) {
      (updated as any).description = componentEditor.description?.trim() || undefined;
    }
    
    // Special handling for datasheet file (for IntegratedCircuit/Transistor)
    // CRITICAL: componentType should NEVER be changed here - it's set correctly at creation time
    const compType = comp.componentType;
    const isIntegratedCircuit = compType === 'IntegratedCircuit';
    const isTransistor = compType === 'Transistor';
    
    // Both IntegratedCircuits and Transistors can have datasheet files
    if (isIntegratedCircuit || isTransistor) {
      // Save uploaded datasheet file path
      if (componentEditor.datasheetFileName) {
        (updated as any).datasheetFileName = componentEditor.datasheetFileName;
      } else {
        (updated as any).datasheetFileName = undefined;
      }
    }
    
    // Legacy hardcoded logic - DISABLED - All component types should now use data-driven approach
    // This code is kept for reference but should never execute
    // TypeScript still type-checks this code even though it's disabled, so we use a non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (false) {
      // Type assertion for disabled code block - this code never executes
      const _componentEditor = componentEditor!;
    if (comp.componentType === 'Resistor') {
      (updated as any).capacitance = _componentEditor.capacitance !== undefined ? _componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = _componentEditor.capacitanceUnit !== undefined ? _componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = _componentEditor.tolerance !== undefined ? _componentEditor.tolerance : undefined;
      (updated as any).dielectric = _componentEditor.dielectric !== undefined ? _componentEditor.dielectric : undefined;
    } else if (comp.componentType === 'Electrolytic Capacitor') {
      (updated as any).capacitance = _componentEditor.capacitance !== undefined ? _componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = _componentEditor.capacitanceUnit !== undefined ? _componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = _componentEditor.tolerance !== undefined ? _componentEditor.tolerance : undefined;
      // polarized is now a fixed property from definition, not user-editable
      (updated as any).esr = _componentEditor.esr !== undefined ? _componentEditor.esr : undefined;
      (updated as any).esrUnit = _componentEditor.esrUnit !== undefined ? _componentEditor.esrUnit : undefined;
      (updated as any).temperature = _componentEditor.temperature !== undefined ? _componentEditor.temperature : undefined;
    } else if (comp.componentType === 'Film Capacitor') {
      (updated as any).capacitance = _componentEditor.capacitance !== undefined ? _componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = _componentEditor.capacitanceUnit !== undefined ? _componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = _componentEditor.tolerance !== undefined ? _componentEditor.tolerance : undefined;
      (updated as any).filmType = _componentEditor.filmType || undefined;
    } else if (comp.componentType === 'Diode') {
      // Pre-fill diodeType from component's diodeType property (set during creation from radio button selection)
      (updated as any).diodeType = _componentEditor.diodeType || (comp as any).diodeType || 'Standard';
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
      (updated as any).ledColor = _componentEditor.ledColor !== undefined ? _componentEditor.ledColor : undefined;
    } else if (comp.componentType === 'Battery') {
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).capacity = _componentEditor.capacity !== undefined ? _componentEditor.capacity : undefined;
      (updated as any).capacityUnit = _componentEditor.capacityUnit !== undefined ? _componentEditor.capacityUnit : undefined;
      (updated as any).chemistry = _componentEditor.chemistry !== undefined ? _componentEditor.chemistry : undefined;
    } else if (comp.componentType === 'Fuse') {
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).fuseType = _componentEditor.fuseType !== undefined ? _componentEditor.fuseType : undefined;
    } else if (comp.componentType === 'FerriteBead') {
      (updated as any).impedance = _componentEditor.impedance !== undefined ? _componentEditor.impedance : undefined;
      (updated as any).impedanceUnit = _componentEditor.impedanceUnit !== undefined ? _componentEditor.impedanceUnit : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'Connector') {
      (updated as any).connectorType = _componentEditor.connectorType || undefined;
      (updated as any).gender = _componentEditor.gender || undefined;
    } else if (comp.componentType === 'Jumper') {
      (updated as any).positions = _componentEditor.positions || undefined;
    } else if (comp.componentType === 'Relay') {
      (updated as any).coilVoltage = _componentEditor.coilVoltage !== undefined ? _componentEditor.coilVoltage : undefined;
      (updated as any).coilVoltageUnit = _componentEditor.coilVoltageUnit !== undefined ? _componentEditor.coilVoltageUnit : undefined;
      (updated as any).contactType = _componentEditor.contactType !== undefined ? _componentEditor.contactType : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'Inductor') {
      (updated as any).inductance = _componentEditor.inductance !== undefined ? _componentEditor.inductance : undefined;
      (updated as any).inductanceUnit = _componentEditor.inductanceUnit !== undefined ? _componentEditor.inductanceUnit : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
      (updated as any).resistance = _componentEditor.resistance !== undefined ? _componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = _componentEditor.resistanceUnit !== undefined ? _componentEditor.resistanceUnit : undefined;
    } else if (comp.componentType === 'Speaker') {
      (updated as any).impedance = _componentEditor.impedance !== undefined ? _componentEditor.impedance : undefined;
      (updated as any).impedanceUnit = _componentEditor.impedanceUnit !== undefined ? _componentEditor.impedanceUnit : undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = _componentEditor.power ? `${_componentEditor.power}W` : undefined;
    } else if (comp.componentType === 'Motor') {
      (updated as any).motorType = _componentEditor.motorType !== undefined ? _componentEditor.motorType : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'PowerSupply') {
      (updated as any).inputVoltage = _componentEditor.inputVoltage !== undefined ? _componentEditor.inputVoltage : undefined;
      (updated as any).inputVoltageUnit = _componentEditor.inputVoltageUnit !== undefined ? _componentEditor.inputVoltageUnit : undefined;
      (updated as any).outputVoltage = _componentEditor.outputVoltage !== undefined ? _componentEditor.outputVoltage : undefined;
      (updated as any).outputVoltageUnit = _componentEditor.outputVoltageUnit !== undefined ? _componentEditor.outputVoltageUnit : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'Transistor') {
      (updated as any).transistorType = _componentEditor.transistorType !== undefined ? _componentEditor.transistorType : undefined;
      (updated as any).polarity = _componentEditor.polarity !== undefined ? _componentEditor.polarity : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'ResistorNetwork') {
      (updated as any).resistance = _componentEditor.resistance !== undefined ? _componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = _componentEditor.resistanceUnit !== undefined ? _componentEditor.resistanceUnit : undefined;
      (updated as any).configuration = _componentEditor.configuration || undefined;
    } else if (comp.componentType === 'Thermistor') {
      (updated as any).resistance = _componentEditor.resistance !== undefined ? _componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = _componentEditor.resistanceUnit !== undefined ? _componentEditor.resistanceUnit : undefined;
      (updated as any).thermistorType = _componentEditor.thermistorType || undefined;
      (updated as any).beta = _componentEditor.beta || undefined;
    } else if (comp.componentType === 'Switch') {
      (updated as any).switchType = _componentEditor.switchType !== undefined ? _componentEditor.switchType : undefined;
      (updated as any).current = _componentEditor.current !== undefined ? _componentEditor.current : undefined;
      (updated as any).currentUnit = _componentEditor.currentUnit !== undefined ? _componentEditor.currentUnit : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
    } else if (comp.componentType === 'Transformer') {
      (updated as any).primaryVoltage = _componentEditor.primaryVoltage !== undefined ? _componentEditor.primaryVoltage : undefined;
      (updated as any).primaryVoltageUnit = _componentEditor.primaryVoltageUnit !== undefined ? _componentEditor.primaryVoltageUnit : undefined;
      (updated as any).secondaryVoltage = _componentEditor.secondaryVoltage !== undefined ? _componentEditor.secondaryVoltage : undefined;
      (updated as any).secondaryVoltageUnit = _componentEditor.secondaryVoltageUnit !== undefined ? _componentEditor.secondaryVoltageUnit : undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = _componentEditor.power ? `${_componentEditor.power}W` : undefined;
      (updated as any).turns = _componentEditor.turns || undefined;
    } else if (comp.componentType === 'TestPoint') {
      (updated as any).signal = _componentEditor.signal || undefined;
    } else if ((comp.componentType as string) === 'Film Capacitor') {
      (updated as any).capacitance = _componentEditor.capacitance !== undefined ? _componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = _componentEditor.capacitanceUnit !== undefined ? _componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = _componentEditor.voltage !== undefined ? _componentEditor.voltage : undefined;
      (updated as any).voltageUnit = _componentEditor.voltageUnit !== undefined ? _componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = _componentEditor.tolerance !== undefined ? _componentEditor.tolerance : undefined;
      (updated as any).filmType = _componentEditor.filmType || undefined;
    } else if (comp.componentType === 'IntegratedCircuit') {
      // For ICs, save description from the Description field
      updated.description = _componentEditor.description?.trim() || undefined;
      updated.icType = _componentEditor.icType || undefined;
    } else if (comp.componentType === 'Transistor') {
      // For transistors, save description
      updated.description = _componentEditor.description?.trim() || undefined;
      // Transistors don't have icType
    }
    } // End of disabled legacy code block (if (false))
    
    // Save manufacturer, part number, operating temperature, and package type for all components that support them
    // These fields are handled by the data-driven system via componentDefinitions.json
    if (componentEditor.manufacturer !== undefined) {
      (updated as any).manufacturer = componentEditor.manufacturer?.trim() || undefined;
    }
    if (componentEditor.partNumber !== undefined) {
      (updated as any).partNumber = componentEditor.partNumber?.trim() || undefined;
    }
    if ((componentEditor as any).operatingTemperature !== undefined) {
      (updated as any).operatingTemperature = (componentEditor as any).operatingTemperature?.trim() || undefined;
    }
    if ((componentEditor as any).packageType !== undefined) {
      (updated as any).packageType = (componentEditor as any).packageType || undefined;
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
      // Debug: Log componentEditor state before update
      console.log('[ComponentEditor] handleSave - componentEditor state before update:', {
        resistance: componentEditor.resistance,
        resistanceUnit: componentEditor.resistanceUnit,
        capacitance: componentEditor.capacitance,
        capacitanceUnit: componentEditor.capacitanceUnit,
        componentType: currentComp.componentType,
      });
      
      const updatedComp = updateComponent(currentComp);
      
      // Debug: Log updated component after save
      console.log('[ComponentEditor] handleSave - updatedComp after save:', {
        resistance: (updatedComp as any).resistance,
        resistanceUnit: (updatedComp as any).resistanceUnit,
        capacitance: (updatedComp as any).capacitance,
        capacitanceUnit: (updatedComp as any).capacitanceUnit,
        componentType: updatedComp.componentType,
        componentDefinitionKey: (updatedComp as any).componentDefinitionKey,
        hadKeyBefore: !!(currentComp as any).componentDefinitionKey,
        hasKeyAfter: !!(updatedComp as any).componentDefinitionKey,
      });
      
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
                // Debug: Log the updated component values
                if (updatedComp.componentType === 'Resistor' || updatedComp.componentType === 'Capacitor') {
                  console.log('[ComponentEditor] Updated component values:', {
                    resistance: (updatedComp as any).resistance,
                    resistanceUnit: (updatedComp as any).resistanceUnit,
                    capacitance: (updatedComp as any).capacitance,
                    capacitanceUnit: (updatedComp as any).capacitanceUnit,
                  });
                }
                return updatedComp;
              }
              return c;
            });
            // Verify the update worked
            const found = updated.find(c => c.id === componentEditor.id);
            if (found) {
              if (found.componentType === 'IntegratedCircuit') {
              console.log('[ComponentEditor] After state update - component datasheet in array:', (found as any).datasheet);
              }
              // Debug: Verify values were saved
              if (found.componentType === 'Resistor' || found.componentType === 'Capacitor') {
                console.log('[ComponentEditor] After state update - component values in array:', {
                  resistance: (found as any).resistance,
                  resistanceUnit: (found as any).resistanceUnit,
                  capacitance: (found as any).capacitance,
                  capacitanceUnit: (found as any).capacitanceUnit,
                });
              }
            }
            return updated;
          });
        } else {
          setComponentsBottom(prev => {
            const updated = prev.map(c => {
              if (c.id === componentEditor.id) {
                console.log('[ComponentEditor] Updating component in bottom array - datasheet:', (updatedComp as any).datasheet);
                // Debug: Log the updated component values
                if (updatedComp.componentType === 'Resistor' || updatedComp.componentType === 'Capacitor') {
                  console.log('[ComponentEditor] Updated component values:', {
                    resistance: (updatedComp as any).resistance,
                    resistanceUnit: (updatedComp as any).resistanceUnit,
                    capacitance: (updatedComp as any).capacitance,
                    capacitanceUnit: (updatedComp as any).capacitanceUnit,
                  });
                }
                return updatedComp;
              }
              return c;
            });
            // Verify the update worked
            const found = updated.find(c => c.id === componentEditor.id);
            if (found) {
              if (found.componentType === 'IntegratedCircuit') {
              console.log('[ComponentEditor] After state update - component datasheet in array:', (found as any).datasheet);
              }
              // Debug: Verify values were saved
              if (found.componentType === 'Resistor' || found.componentType === 'Capacitor') {
                console.log('[ComponentEditor] After state update - component values in array:', {
                  resistance: (found as any).resistance,
                  resistanceUnit: (found as any).resistanceUnit,
                  capacitance: (found as any).capacitance,
                  capacitanceUnit: (found as any).capacitanceUnit,
                });
              }
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
  // Function to normalize pin names to match preset values from component definitions
  const normalizePinName = (pinName: string, presetPinNames: string[] | undefined): string => {
    if (!presetPinNames || presetPinNames.length === 0) {
      return pinName; // No preset names, return as-is
    }
    
    const normalized = pinName.trim();
    
    // Create a mapping of common variations to preset names
    // This handles abbreviations and alternative naming conventions
    const variationMap: Record<string, string> = {};
    
    // Build mapping from preset names and their common variations
    presetPinNames.forEach(preset => {
      const presetUpper = preset.toUpperCase();
      const presetLower = preset.toLowerCase();
      
      // Map the preset name to itself
      variationMap[presetUpper] = preset;
      variationMap[presetLower] = preset;
      variationMap[preset] = preset;
      
      // Common variations for op amps
      if (preset === 'Output 1' || preset === '1OUT') {
        variationMap['OUT1'] = preset;
        variationMap['OUT 1'] = preset;
        variationMap['OUTPUT1'] = preset;
        variationMap['OUTPUT 1'] = preset;
      }
      if (preset === 'Output 2' || preset === '2OUT') {
        variationMap['OUT2'] = preset;
        variationMap['OUT 2'] = preset;
        variationMap['OUTPUT2'] = preset;
        variationMap['OUTPUT 2'] = preset;
      }
      if (preset === 'Output 3' || preset === '3OUT') {
        variationMap['OUT3'] = preset;
        variationMap['OUT 3'] = preset;
        variationMap['OUTPUT3'] = preset;
        variationMap['OUTPUT 3'] = preset;
      }
      if (preset === 'Output 4' || preset === '4OUT') {
        variationMap['OUT4'] = preset;
        variationMap['OUT 4'] = preset;
        variationMap['OUTPUT4'] = preset;
        variationMap['OUTPUT 4'] = preset;
      }
      if (preset === 'Input 1-' || preset === '1IN-') {
        variationMap['IN1-'] = preset;
        variationMap['IN 1-'] = preset;
        variationMap['INPUT1-'] = preset;
        variationMap['INPUT 1-'] = preset;
        variationMap['IN1N'] = preset;
        variationMap['IN-1'] = preset;
      }
      if (preset === 'Input 1+' || preset === '1IN+') {
        variationMap['IN1+'] = preset;
        variationMap['IN 1+'] = preset;
        variationMap['INPUT1+'] = preset;
        variationMap['INPUT 1+'] = preset;
        variationMap['IN1P'] = preset;
        variationMap['IN+1'] = preset;
      }
      if (preset === 'Input 2-' || preset === '2IN-') {
        variationMap['IN2-'] = preset;
        variationMap['IN 2-'] = preset;
        variationMap['INPUT2-'] = preset;
        variationMap['INPUT 2-'] = preset;
        variationMap['IN2N'] = preset;
        variationMap['IN-2'] = preset;
      }
      if (preset === 'Input 2+' || preset === '2IN+') {
        variationMap['IN2+'] = preset;
        variationMap['IN 2+'] = preset;
        variationMap['INPUT2+'] = preset;
        variationMap['INPUT 2+'] = preset;
        variationMap['IN2P'] = preset;
        variationMap['IN+2'] = preset;
      }
      if (preset === 'Input 3-' || preset === '3IN-') {
        variationMap['IN3-'] = preset;
        variationMap['IN 3-'] = preset;
        variationMap['INPUT3-'] = preset;
        variationMap['INPUT 3-'] = preset;
        variationMap['IN3N'] = preset;
        variationMap['IN-3'] = preset;
      }
      if (preset === 'Input 3+' || preset === '3IN+') {
        variationMap['IN3+'] = preset;
        variationMap['IN 3+'] = preset;
        variationMap['INPUT3+'] = preset;
        variationMap['INPUT 3+'] = preset;
        variationMap['IN3P'] = preset;
        variationMap['IN+3'] = preset;
      }
      if (preset === 'Input 4-' || preset === '4IN-') {
        variationMap['IN4-'] = preset;
        variationMap['IN 4-'] = preset;
        variationMap['INPUT4-'] = preset;
        variationMap['INPUT 4-'] = preset;
        variationMap['IN4N'] = preset;
        variationMap['IN-4'] = preset;
      }
      if (preset === 'Input 4+' || preset === '4IN+') {
        variationMap['IN4+'] = preset;
        variationMap['IN 4+'] = preset;
        variationMap['INPUT4+'] = preset;
        variationMap['INPUT 4+'] = preset;
        variationMap['IN4P'] = preset;
        variationMap['IN+4'] = preset;
      }
      if (preset === 'VEE / GND') {
        variationMap['V-'] = preset;
        variationMap['VEE'] = preset;
        variationMap['GND'] = preset;
        variationMap['VSS'] = preset;
        variationMap['VEE/GND'] = preset;
        variationMap['VEE /GND'] = preset;
        variationMap['VEE/ GND'] = preset;
        variationMap['VEE/GND'] = preset;
      }
      if (preset === 'VCC-') {
        variationMap['V-'] = preset;
        variationMap['VEE'] = preset;
        variationMap['GND'] = preset;
        variationMap['VSS'] = preset;
        variationMap['VEE/GND'] = preset;
        variationMap['VEE /GND'] = preset;
        variationMap['VEE/ GND'] = preset;
      }
      if (preset === 'VCC / V+') {
        variationMap['V+'] = preset;
        variationMap['VCC'] = preset;
        variationMap['VDD'] = preset;
        variationMap['VCC/V+'] = preset;
        variationMap['VCC /V+'] = preset;
        variationMap['VCC/ V+'] = preset;
      }
      if (preset === 'VCC+') {
        variationMap['V+'] = preset;
        variationMap['VCC'] = preset;
        variationMap['VDD'] = preset;
        variationMap['VCC/V+'] = preset;
        variationMap['VCC /V+'] = preset;
        variationMap['VCC/ V+'] = preset;
      }
      if (preset === 'V-' || preset === 'VEE / GND') {
        variationMap['VEE'] = preset;
        variationMap['GND'] = preset;
        variationMap['VSS'] = preset;
      }
      if (preset === 'V+' || preset === 'VCC / V+') {
        variationMap['VCC'] = preset;
        variationMap['VDD'] = preset;
      }
      if (preset === 'input+' || preset === 'IN+') {
        variationMap['IN+'] = preset;
        variationMap['INPUT+'] = preset;
        variationMap['INPUT +'] = preset;
        variationMap['INP'] = preset;
      }
      if (preset === 'input-' || preset === 'IN-') {
        variationMap['IN-'] = preset;
        variationMap['INPUT-'] = preset;
        variationMap['INPUT -'] = preset;
        variationMap['INN'] = preset;
      }
      if (preset === 'output' || preset === 'OUT') {
        variationMap['OUT'] = preset;
        variationMap['OUTPUT'] = preset;
      }
      // Common variations for transistors (Source, Drain, Gate)
      if (preset === 'Source') {
        variationMap['S'] = preset;
        variationMap['SRC'] = preset;
        variationMap['SOURCE'] = preset;
        variationMap['s'] = preset;
        variationMap['src'] = preset;
        variationMap['source'] = preset;
      }
      if (preset === 'Drain') {
        variationMap['D'] = preset;
        variationMap['DRN'] = preset;
        variationMap['DRAIN'] = preset;
        variationMap['d'] = preset;
        variationMap['drn'] = preset;
        variationMap['drain'] = preset;
      }
      if (preset === 'Gate') {
        variationMap['G'] = preset;
        variationMap['GAT'] = preset;
        variationMap['GATE'] = preset;
        variationMap['g'] = preset;
        variationMap['gat'] = preset;
        variationMap['gate'] = preset;
      }
    });
    
    // Try exact match first (case-insensitive)
    const normalizedUpper = normalized.toUpperCase();
    if (variationMap[normalizedUpper]) {
      return variationMap[normalizedUpper];
    }
    
    // Try with the original case
    if (variationMap[normalized]) {
      return variationMap[normalized];
    }
    
    // Try case-insensitive match against preset names directly
    const presetMatch = presetPinNames.find(p => 
      p.toUpperCase() === normalizedUpper || 
      p.toLowerCase() === normalized.toLowerCase()
    );
    if (presetMatch) {
      return presetMatch;
    }
    
    // No match found, return original
    return pinName;
  };

  const handleFetchPinNames = async () => {
    // Check if API key is configured for current service
    const service = getCurrentService();
    
    if (!service.hasApiKey()) {
      setShowApiKeyDialog(true);
      return;
    }
    
    // Require uploaded file or file in project directory
    const datasheetPath = (comp as any)?.datasheetFileName;
    if (!uploadedDatasheetFile && (!projectDirHandle || !datasheetPath)) {
      setInfoDialog({
        visible: true,
        title: 'Datasheet Required',
        message: 'Please choose a datasheet file before extracting information.',
        type: 'info',
      });
      return;
    }
    
    setIsFetchingPinNames(true);
    
    try {
      // Use uploaded file or read from project directory
      let arrayBuffer: ArrayBuffer;
      let fileSize: number;
      
      if (uploadedDatasheetFile) {
        // Read directly from File object
        arrayBuffer = await uploadedDatasheetFile.arrayBuffer();
        fileSize = uploadedDatasheetFile.size;
      } else if (projectDirHandle && datasheetPath) {
        // Read from project directory
        const pathParts = datasheetPath.split('/');
        let dirHandle = projectDirHandle;
        
        // Navigate to subdirectory if path contains '/'
        // Use getDirectoryHandle without create: true (same as images)
        // Handle case sensitivity like image loading does
        for (let i = 0; i < pathParts.length - 1; i++) {
          const dirName = pathParts[i];
          try {
            dirHandle = await dirHandle.getDirectoryHandle(dirName);
          } catch (e) {
            // Try alternative case if first attempt fails
            const altName = dirName === 'datasheets' ? 'Datasheets' : 
                           dirName === 'Datasheets' ? 'datasheets' : dirName;
            try {
              dirHandle = await dirHandle.getDirectoryHandle(altName);
            } catch (e2) {
              throw new Error(`Directory '${dirName}' not found in project folder.`);
            }
          }
        }
        
        const fileHandle = await dirHandle.getFileHandle(pathParts[pathParts.length - 1]);
        const file = await fileHandle.getFile();
        arrayBuffer = await file.arrayBuffer();
        fileSize = file.size;
      } else {
        throw new Error('No datasheet file available');
      }
      
      // Check file size limit (20MB for Gemini API inline data)
      const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes
      if (fileSize > maxFileSize) {
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        throw new Error(`PDF file is too large (${fileSizeMB} MB). Maximum file size is 20 MB. Please use a smaller file or split the datasheet.`);
      }
      
      // Convert PDF to base64 for inline data submission
      // Base64 encoding increases size by ~33%, but we've already checked the original size
      // Use FileReader API for reliable base64 encoding
      const base64Data = await new Promise<string>((resolve, reject) => {
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Extract base64 data from data URL (remove "data:application/pdf;base64," prefix)
          const base64 = dataUrl.split(',')[1];
          if (!base64) {
            reject(new Error('Failed to extract base64 data from FileReader result'));
            return;
          }
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('FileReader failed to read PDF file'));
        reader.readAsDataURL(blob);
      });
      
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

      // Prompt selection priority:
      // 1. Component-specific custom prompt (user override) - highest priority
      // 2. Named prompt from aiPrompts.json (aiPromptName) - data-driven default
      // 3. Inline prompt from definition (aiPrompt) - backward compatibility
      // 4. Generic default prompt - fallback
      let prompt: string | undefined;
      const componentCustomPrompt = (currentComp as any).componentPropertiesAIPrompt;
      if (componentCustomPrompt && componentCustomPrompt.trim()) {
        // Use custom prompt as-is (no text replacement needed with PDF submission)
        prompt = componentCustomPrompt;
      } else {
        const componentDef = resolveComponentDefinition(currentComp as any);
        
        // Try named prompt first (preferred method)
        if (componentDef?.aiPromptName) {
          prompt = getAIPrompt(componentDef.aiPromptName);
          if (!prompt) {
            console.warn(`[AI Prompt] Prompt name "${componentDef.aiPromptName}" not found in aiPrompts.json, falling back to inline or default`);
          }
        }
        
        // Fall back to inline prompt if named prompt not found or not specified
        if (!prompt && componentDef?.aiPrompt && componentDef.aiPrompt.trim()) {
          prompt = componentDef.aiPrompt;
        }
        
        // Final fallback: generic default prompt
        if (!prompt) {
          prompt = buildDefaultPrompt(fieldsToExtract);
        }
      }
      
      // Ensure prompt is always defined (should never happen, but TypeScript needs this)
      if (!prompt) {
        console.error('[AI Prompt] No prompt available, using generic default');
        prompt = buildDefaultPrompt(fieldsToExtract);
      }

      // Call AI service with PDF
      const aiService = getCurrentService();
      const serviceInfo = SERVICE_INFO[getAIConfig().provider];
      
      const aiResponse = await aiService.extractFromPDF({
        prompt,
        pdfBase64: base64Data,
                  mimeType: 'application/pdf',
      });

      if (!aiResponse.success) {
        throw new Error(aiResponse.error || `${serviceInfo.name} API error`);
      }

      let responseText = aiResponse.text || '';

      if (!responseText) {
        throw new Error(`No response text from ${serviceInfo.name} API. The API may have returned an empty response.`);
      }

      // Parse JSON response
      // Remove markdown code blocks if present (Gemini sometimes wraps in ```json or ```)
      responseText = responseText.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');
      
      let extractedData: any;
      try {
        extractedData = JSON.parse(responseText);
      } catch (parseError) {
        // Keep the raw response stored for display
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

      // Extract pin data - use extracted pin count
      // Structure: Array of { name: string, type?: string, alternate_functions?: string[] }
      const pinData: Array<{ name: string; type?: string; alternate_functions?: string[] }> = new Array(extractedPinCount).fill(null).map(() => ({ name: '' }));
      let parsedPinCount = 0;
      
      // Get preset pin names from component definition for normalization
      const componentDef = resolveComponentDefinition(currentComp as any);
      const presetPinNames = componentDef?.properties?.pinNames as string[] | undefined;
      
      if (extractedData.pins && Array.isArray(extractedData.pins)) {
        for (const pin of extractedData.pins) {
          if (pin && typeof pin === 'object' && pin.pinNumber && pin.pinName) {
            const pinNum = parseInt(String(pin.pinNumber), 10);
            if (!isNaN(pinNum) && pinNum >= 1 && pinNum <= extractedPinCount) {
              const pinIndex = pinNum - 1;
              const rawPinName = String(pin.pinName).trim();
              // Normalize pin name to match preset values
              const normalizedPinName = normalizePinName(rawPinName, presetPinNames);
              
              pinData[pinIndex] = {
                name: normalizedPinName,
                type: pin.pinType && String(pin.pinType).trim() ? String(pin.pinType).trim() : undefined,
                alternate_functions: pin.alternateFunctions && Array.isArray(pin.alternateFunctions) && pin.alternateFunctions.length > 0
                  ? pin.alternateFunctions.map((af: any) => String(af).trim()).filter((af: string) => af !== '')
                  : undefined
              };
              parsedPinCount++;
            }
          }
        }
      }

      if (parsedPinCount === 0) {
        throw new Error('Could not parse any pin information from the JSON response.');
      }
      
      // pinNames array is maintained in adjustedPinNames below for backward compatibility

      // Extract component properties and update componentEditor
      const updatedEditor: any = { ...componentEditor };
      let propertiesExtracted = 0;
      const extractedPropertiesList: Array<{ label: string; value: string }> = [];
      
      // Update pin count if extracted
      if (extractedPinCount !== componentEditor.pinCount) {
        updatedEditor.pinCount = extractedPinCount;
        extractedPropertiesList.push({ label: 'Pin Count', value: String(extractedPinCount) });
        propertiesExtracted++;
      }
      
      if (extractedData.properties && typeof extractedData.properties === 'object') {
        const props = extractedData.properties;
        
        // Update each field that was found in the response
        for (const field of fieldsToExtract) {
          if (props.hasOwnProperty(field.name)) {
            const value = props[field.name];
            
            if (value !== null && value !== undefined && value !== '') {
              let displayValue = '';
              if (field.hasUnits) {
                // For fields with units, extract both value and unit
                updatedEditor[field.name] = String(value);
                const unitKey = `${field.name}Unit`;
                let unit = '';
                if (props.hasOwnProperty(unitKey)) {
                  const unitValue = String(props[unitKey]).trim();
                  // Validate unit is in the allowed list
                  if (field.units.includes(unitValue)) {
                    updatedEditor[unitKey] = unitValue;
                    unit = unitValue;
                  } else if (field.units.length > 0) {
                    // Use default unit if provided unit is not valid
                    updatedEditor[unitKey] = field.units[0];
                    unit = field.units[0];
                  }
                } else if (field.units.length > 0) {
                  // Use default unit if not provided
                  updatedEditor[unitKey] = field.units[0];
                  unit = field.units[0];
                }
                displayValue = `${value} ${unit}`.trim();
              } else {
                // For fields without units, just set the value
                updatedEditor[field.name] = String(value);
                displayValue = String(value);
              }
              extractedPropertiesList.push({ label: field.label, value: displayValue });
              propertiesExtracted++;
            }
          }
        }
        
        // Handle IC Type if present
        if (props.hasOwnProperty('icType') && props.icType) {
          const icType = String(props.icType).trim();
          const validIcTypes = ['BJT NPN', 'BJT PNP', 'MOSFET N-Channel', 'MOSFET P-Channel', 'JFET', 'Op-Amp', 'Microcontroller', 'Microprocessor', 'Logic', 'Memory', 'Voltage Regulator', 'Timer', 'ADC', 'DAC', 'Comparator', 'Transceiver', 'Driver', 'Amplifier', 'Other'];
          if (validIcTypes.includes(icType)) {
            updatedEditor.icType = icType;
            extractedPropertiesList.push({ label: 'IC Type', value: icType });
            propertiesExtracted++;
          }
        }
        
        // Handle Package Type if present
        if (props.hasOwnProperty('packageType') && props.packageType) {
          const packageType = String(props.packageType).trim();
          // Valid package types from componentDefinitions.json
          const validPackageTypes = ['DIP', 'PDIP', 'SOIC', 'QFP', 'LQFP', 'TQFP', 'BGA', 'SSOP', 'TSOP', 'Various', 'Other'];
          // Also check if it's a common variation (e.g., "PDIP" might be returned as "DIP")
          let normalizedPackageType = packageType;
          if (packageType.toUpperCase() === 'PDIP' || packageType.toUpperCase() === 'DIP') {
            // If multiple package types are mentioned, use "Various"
            if (packageType.includes(',') || packageType.includes(' or ') || packageType.includes(' and ')) {
              normalizedPackageType = 'Various';
            } else if (packageType.toUpperCase().includes('PDIP')) {
              normalizedPackageType = 'PDIP';
            } else {
              normalizedPackageType = 'DIP';
            }
          } else if (validPackageTypes.includes(packageType)) {
            normalizedPackageType = packageType;
          } else if (packageType.includes(',') || packageType.includes(' or ') || packageType.includes(' and ')) {
            // Multiple package types mentioned
            normalizedPackageType = 'Various';
          } else {
            // Try to match common variations
            const upperPackageType = packageType.toUpperCase();
            if (upperPackageType.includes('LQFP')) normalizedPackageType = 'LQFP';
            else if (upperPackageType.includes('TQFP')) normalizedPackageType = 'TQFP';
            else if (upperPackageType.includes('QFP')) normalizedPackageType = 'QFP';
            else if (upperPackageType.includes('SOIC')) normalizedPackageType = 'SOIC';
            else if (upperPackageType.includes('BGA')) normalizedPackageType = 'BGA';
            else if (upperPackageType.includes('SSOP')) normalizedPackageType = 'SSOP';
            else if (upperPackageType.includes('TSOP')) normalizedPackageType = 'TSOP';
            else normalizedPackageType = 'Other';
          }
          
          if (validPackageTypes.includes(normalizedPackageType) || normalizedPackageType === 'Various') {
            (updatedEditor as any).packageType = normalizedPackageType;
            extractedPropertiesList.push({ label: 'Package Type', value: normalizedPackageType });
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
          // Truncate summary for display if too long
          const summaryDisplay = datasheetSummary.length > 100 
            ? datasheetSummary.substring(0, 100) + '...' 
            : datasheetSummary;
          extractedPropertiesList.push({ label: 'Notes', value: summaryDisplay });
          propertiesExtracted++;
        }
      }

      // Ensure pinData array matches pin count
      const adjustedPinData = [...pinData];
      while (adjustedPinData.length < extractedPinCount) {
        adjustedPinData.push({ name: '' });
      }
      
      // Also maintain pinNames array for backward compatibility
      const adjustedPinNames = adjustedPinData.map(pd => pd.name);
      
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
        
        // Include all extracted properties in the component update
        // CRITICAL: Preserve or set componentDefinitionKey to maintain component definition resolution
        // The key MUST be preserved - it's essential for rendering the correct fields on reopen
        let componentDefKey = (currentComp as any)?.componentDefinitionKey;
        if (!componentDefKey && componentDefinition) {
          // Set the key from the resolved definition if missing
          componentDefKey = `${componentDefinition.category}:${componentDefinition.subcategory}`;
          console.log('[AI Extraction] Setting componentDefinitionKey from componentDefinition:', componentDefKey);
        } else if (!componentDefKey && (componentEditor as any)?.componentDefinition) {
          // Fallback: Use key from componentEditor state
          const def = (componentEditor as any).componentDefinition;
          componentDefKey = `${def.category}:${def.subcategory}`;
          console.log('[AI Extraction] Setting componentDefinitionKey from componentEditor:', componentDefKey);
        } else if (componentDefKey) {
          console.log('[AI Extraction] Preserving existing componentDefinitionKey:', componentDefKey);
        } else {
          console.error('[AI Extraction] WARNING: No componentDefinitionKey available!', {
            hasComponentDefinition: !!componentDefinition,
            hasEditorDefinition: !!(componentEditor as any)?.componentDefinition,
            currentComp: currentComp
          });
        }
        
        const updatedComp = { 
          ...currentComp, 
          pinData: adjustedPinData,
          pinNames: adjustedPinNames, // Keep for backward compatibility
          pinCount: extractedPinCount,
          pinConnections: newPinConnections,
          pinPolarities: newPinPolarities,
          // Include datasheet summary in notes if available
          ...(datasheetSummary && { notes: datasheetSummary }),
          // CRITICAL: Always set componentDefinitionKey (never conditionally)
          // This ensures it's preserved even if it was missing before
          componentDefinitionKey: componentDefKey || (currentComp as any)?.componentDefinitionKey || undefined,
          // Include all extracted properties from updatedEditor
          ...Object.fromEntries(
            Object.entries(updatedEditor).filter(([key]) => 
              key !== 'visible' && 
              key !== 'layer' && 
              key !== 'id' && 
              key !== 'x' && 
              key !== 'y' && 
              key !== 'orientation' &&
              key !== 'designator' &&
              key !== 'abbreviation' &&
              key !== 'pinCount' && // Already handled above
              key !== 'pinData' && // Already handled above
              key !== 'pinNames' && // Already handled above
              key !== 'componentDefinition' && // Don't copy componentDefinition to component
              key !== 'componentDefinitionKey' // Already handled above
            )
          )
        };
        
        // Debug logging for AI extraction
        console.log('[AI Extraction] Automatically saving extracted data to component:', {
          componentId: componentEditor.id,
          layer: componentEditor.layer,
          pinData: adjustedPinData,
          pinNames: adjustedPinNames,
          pinCount: extractedPinCount,
          componentDefinitionKey: componentDefKey,
          hadKeyBefore: !!(currentComp as any)?.componentDefinitionKey,
          hasKeyAfter: !!componentDefKey,
          extractedProperties: Object.keys(updatedEditor).filter(key => 
            !['visible', 'layer', 'id', 'x', 'y', 'orientation', 'designator', 'abbreviation', 'pinCount', 'pinData', 'pinNames', 'componentDefinition', 'componentDefinitionKey'].includes(key)
          )
        });
        
        // Automatically save the extracted data to component state
        if (componentEditor.layer === 'top') {
          setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
        } else {
          setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
        }
        
        // Update componentEditor state with extracted properties AND pin data
        // This ensures the UI reflects the changes immediately
        // CRITICAL: Preserve all required fields (id, visible, layer, x, y, orientation, designator, abbreviation)
        // to prevent the editor from closing
        setComponentEditor({
          ...updatedEditor,
          // Explicitly preserve required fields to ensure they're never lost
          id: componentEditor.id,
          visible: componentEditor.visible,
          layer: componentEditor.layer,
          x: componentEditor.x,
          y: componentEditor.y,
          orientation: componentEditor.orientation,
          designator: componentEditor.designator,
          abbreviation: componentEditor.abbreviation,
          pinData: adjustedPinData,
          pinNames: adjustedPinNames,
          pinCount: extractedPinCount,
          // Preserve componentDefinition and componentDefinitionKey to maintain custom field rendering
          componentDefinition: componentEditor.componentDefinition || componentDefinition,
          componentDefinitionKey: (componentEditor as any).componentDefinitionKey || (currentComp as any)?.componentDefinitionKey
        });
        
        const foundCount = adjustedPinNames.filter(name => name.length > 0).length;
        let message = `Extracted ${foundCount} pin name${foundCount !== 1 ? 's' : ''}`;
        if (extractedPinCount !== componentEditor.pinCount) {
          message += ` and pin count`;
        }
        if (propertiesExtracted > 0) {
          message += ` and ${propertiesExtracted} propert${propertiesExtracted === 1 ? 'y' : 'ies'}`;
        }
        message += ' from datasheet.';
        message += '\n\nData has been automatically saved to the component.';
        
        // Add formatted list of extracted properties if any
        if (extractedPropertiesList.length > 0) {
          message += '\n\nExtracted Properties:';
          extractedPropertiesList.forEach(prop => {
            message += `\n  • ${prop.label}: ${prop.value}`;
          });
        }
        
        // Add pin names list below all other properties
        const pinNamesList: string[] = [];
        adjustedPinNames.forEach((name, index) => {
          if (name && name.trim()) {
            pinNamesList.push(`Pin ${index + 1}: ${name.trim()}`);
          }
        });
        
        if (pinNamesList.length > 0) {
          message += '\n\nPin Names:';
          message += '\n  ' + pinNamesList.join(', ');
        }
        
        setInfoDialog({
          visible: true,
          title: 'Extraction Complete',
          message: message,
          type: 'success',
        });
        // Keep raw response available for viewing (don't clear it)
        // User can view it using the "View AI Response" button
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
        top: componentDialogPosition ? `${componentDialogPosition.y}px` : '16px',
        left: componentDialogPosition ? `${componentDialogPosition.x}px` : '254px',
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
      <div 
        className="component-editor-content"
        style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '4px',
        padding: '6px 20px 6px 6px', // Extra right padding for scrollbar
        overflowY: 'auto',
          overflowX: 'hidden',
        flex: 1,
        minHeight: 0,
          scrollbarWidth: 'thin',
          scrollbarColor: '#888 #f0f0f0',
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
        
        {/* Designator - on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            onKeyDown={(e) => {
              // Allow Enter key to trigger Find
              if (e.key === 'Enter' && !areComponentsLocked) {
                e.preventDefault();
                handleFindByDesignator();
              }
            }}
          />
          <button
            onClick={handleFindByDesignator}
            disabled={areComponentsLocked || !componentEditor.designator?.trim()}
            style={{
              padding: '4px 12px',
              background: areComponentsLocked || !componentEditor.designator?.trim() 
                ? '#ccc' 
                : 'linear-gradient(90deg, #7B68EE 0%, #6A5ACD 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: areComponentsLocked || !componentEditor.designator?.trim() ? 'not-allowed' : 'pointer',
              opacity: areComponentsLocked || !componentEditor.designator?.trim() ? 0.6 : 1,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              whiteSpace: 'nowrap',
            }}
            title="Find all components with this designator"
          >
            Find
          </button>
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
        
        {/* Datasheet section - shown when enableAI is true in component definition */}
        {componentDefinition?.enableAI === true && (
          <>
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
                        
                        // Copy file to project directory if available
                        let datasheetFilePath = file.name; // Default to just filename
                        if (projectDirHandle) {
                          try {
                            // Create datasheets subdirectory if it doesn't exist
                            let datasheetsDirHandle: FileSystemDirectoryHandle;
                            try {
                              datasheetsDirHandle = await projectDirHandle.getDirectoryHandle('datasheets', { create: true });
                            } catch (e) {
                              console.error('Failed to get/create datasheets directory:', e);
                              // Fall back to root directory
                              datasheetsDirHandle = projectDirHandle;
                            }
                            
                            // Copy file to project directory
                            const fileHandle = await datasheetsDirHandle.getFileHandle(file.name, { create: true });
                            const writable = await fileHandle.createWritable();
                            await writable.write(await file.arrayBuffer());
                            await writable.close();
                            
                            // Store relative path from project root
                            datasheetFilePath = datasheetsDirHandle === projectDirHandle 
                              ? file.name 
                              : `datasheets/${file.name}`;
                          } catch (error) {
                            console.error('Failed to copy datasheet to project directory:', error);
                            // Continue with just filename if copy fails
                          }
                        }
                        
                        // Store the file path (relative to project root)
                        setComponentEditor({
                          ...componentEditor,
                          datasheetFileName: datasheetFilePath,
                        });
                      } else {
                        setUploadedDatasheetFile(null);
                        setComponentEditor({
                          ...componentEditor,
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
                      background: areComponentsLocked ? '#ccc' : '#4CAF50',
                      border: 'none',
                      borderRadius: 2,
                      fontSize: '11px',
                      color: '#fff',
                      cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                      opacity: areComponentsLocked ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                      flex: '0 0 auto'
                    }}
                  >
                    Choose File
                  </label>
                  {(() => {
                    // Extract just the filename from the path
                    // Check componentEditor first (for newly selected files), then component (for saved files)
                    const datasheetPath = componentEditor.datasheetFileName || (comp as any)?.datasheetFileName;
                    const fileName = uploadedDatasheetFile?.name || (datasheetPath ? datasheetPath.split('/').pop() : null);
                    const hasFileObject = !!uploadedDatasheetFile;
                    
                    if (fileName) {
                      if (hasFileObject) {
                        // File object is available - make it clickable
                        return (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                // Use the in-memory file
                                const file = uploadedDatasheetFile!;
                                
                                // Create blob URL
                                const blobUrl = URL.createObjectURL(file);
                                
                                // Try opening with window.open first
                                const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
                                
                                if (!newWindow || newWindow.closed) {
                                  // Fallback: create a temporary anchor and click it
                                  URL.revokeObjectURL(blobUrl);
                                  const link = document.createElement('a');
                                  const fallbackBlobUrl = URL.createObjectURL(file);
                                  link.href = fallbackBlobUrl;
                                  link.target = '_blank';
                                  link.rel = 'noopener noreferrer';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  // Don't revoke fallback URL immediately
                                } else {
                                  // Don't revoke immediately - let browser handle it when window closes
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
                      } else if (datasheetPath && projectDirHandle) {
                        // File path exists and project directory is available - lazy load on click
                        return (
                          <a
                            href="#"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                // Lazy load: Read file from project directory only when clicked
                                const pathParts = datasheetPath.split('/');
                                let currentDir = projectDirHandle;
                                
                                // Navigate to subdirectory if path includes one (e.g., "datasheets/file.pdf")
                                for (let i = 0; i < pathParts.length - 1; i++) {
                                  currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
                                }
                                
                                // Get the file
                                const fileHandle = await currentDir.getFileHandle(pathParts[pathParts.length - 1]);
                                const file = await fileHandle.getFile();
                                
                                // Create blob URL and open
                                const blobUrl = URL.createObjectURL(file);
                                const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
                                
                                if (!newWindow || newWindow.closed) {
                                  // Fallback: create temporary anchor
                                  URL.revokeObjectURL(blobUrl);
                                  const link = document.createElement('a');
                                  const fallbackBlobUrl = URL.createObjectURL(file);
                                  link.href = fallbackBlobUrl;
                                  link.target = '_blank';
                                  link.rel = 'noopener noreferrer';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  // Blob URL will be cleaned up by browser when window closes
                                }
                                // Note: We don't revoke the blob URL immediately to allow the PDF to load
                                // The browser will clean it up when the window/tab is closed
                              } catch (error) {
                                console.error('Error opening datasheet from project directory:', error);
                                alert('Failed to open datasheet file. The file may have been moved or deleted from the project directory.');
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
                            title="Click to open PDF from project directory"
                          >
                            {fileName}
                          </a>
                        );
                      } else {
                        // No file object and no project directory - can't open file
                        return (
                          <span 
                            style={{ 
                              fontSize: '11px', 
                              color: '#666', 
                              flex: '0 0 auto',
                              fontStyle: 'italic'
                            }}
                            title="File path stored but project directory not available"
                          >
                            {fileName} (project directory required)
                          </span>
                        );
                      }
                    } else {
                      return (
                        <span style={{ fontSize: '11px', color: '#666', flex: '0 0 auto' }}>No file chosen</span>
                      );
                    }
                  })()}
                </div>
                {/* View/Edit Prompt button - below Choose File */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <button
                    onClick={() => {
                      // Build the current prompt to show in the dialog
                      if (componentEditor && comp) {
                        const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                        const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                        if (currentComp) {
                          const def: ComponentDefinition | undefined = componentDefinition || resolveComponentDefinition(currentComp as any);
                          const availableFields = def?.fields || [];
                          const fieldsToExtract = availableFields
                            .filter(field => field.name !== 'datasheet')
                            .map(field => ({
                              name: field.name,
                              label: field.label,
                              type: field.type,
                              hasUnits: Boolean(field.units && field.units.length > 0),
                              units: field.units || []
                            }));
                          
                          // Prompt selection priority:
                          // 1. Component-specific custom prompt (user override) - highest priority
                          // 2. Named prompt from aiPrompts.json (aiPromptName) - data-driven default
                          // 3. Inline prompt from definition (aiPrompt) - backward compatibility
                          // 4. Generic default prompt - fallback
                          const componentCustomPrompt = (currentComp as any).componentPropertiesAIPrompt;
                          if (componentCustomPrompt && componentCustomPrompt.trim()) {
                            setCustomPrompt(componentCustomPrompt);
                          } else {
                            const componentDef = resolveComponentDefinition(currentComp as any);
                            let promptToUse: string;
                            
                            // Try named prompt first (preferred method)
                            if (componentDef?.aiPromptName) {
                              const namedPrompt = getAIPrompt(componentDef.aiPromptName);
                              if (namedPrompt) {
                                promptToUse = namedPrompt;
                              } else {
                                console.warn(`[AI Prompt] Prompt name "${componentDef.aiPromptName}" not found in aiPrompts.json, falling back to inline or default`);
                                promptToUse = ''; // Will be set below
                              }
                            } else {
                              promptToUse = ''; // Will be set below
                            }
                            
                            // Fall back to inline prompt if named prompt not found or not specified
                            if (!promptToUse && componentDef?.aiPrompt && componentDef.aiPrompt.trim()) {
                              promptToUse = componentDef.aiPrompt;
                            }
                            
                            // Final fallback: generic default prompt
                            if (!promptToUse) {
                              promptToUse = buildDefaultPrompt(fieldsToExtract);
                            }
                            
                            setCustomPrompt(promptToUse);
                          }
                        }
                      }
                      setShowPromptDialog(true);
                    }}
                    disabled={areComponentsLocked}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      background: areComponentsLocked ? '#ccc' : '#0066cc',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                      opacity: areComponentsLocked ? 0.6 : 1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s'
                    }}
                    title="View and edit the AI prompt that will be sent to Gemini"
                  >
                    View/Edit Prompt
                  </button>
                </div>
                {/* Extract Datasheet Information button - below View/Edit Prompt, aligned left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
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
            
            {/* Pin Count - Special handling for all components (not a field definition) */}
            {(
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
            style={{ 
              width: '180px', 
              padding: '2px 3px', 
              background: '#f5f5f5', 
              border: '1px solid #ddd', 
              borderRadius: 2, 
              fontSize: '11px', 
              color: '#000', 
              opacity: areComponentsLocked ? 0.6 : 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            placeholder=""
            title={componentEditor.description || ''}
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
        
        {/* Operating Temperature - for Integrated Circuits */}
        {(comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor={`component-operatingTemperature-${comp.id}`} style={{ fontSize: '11px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '110px', flexShrink: 0 }}>
              Operating Temperature:
            </label>
            <input
              id={`component-operatingTemperature-${comp.id}`}
              name={`component-operatingTemperature-${comp.id}`}
              type="text"
              value={(componentEditor as any).operatingTemperature || ''}
              onChange={(e) => {
                setComponentEditor({ ...componentEditor, operatingTemperature: e.target.value });
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              placeholder=""
              title={(componentEditor as any).operatingTemperature || ''}
            />
          </div>
        )}
        
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
            
            // Get pin data from component instance (user-editable) or definition (defaults)
            const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
            const currentComp = currentCompList.find(c => c.id === componentEditor.id);
            const instancePinData = (currentComp as any)?.pinData as Array<{ name: string; type?: string; alternate_functions?: string[] }> | undefined;
            const instancePinNames = (currentComp as any)?.pinNames as string[] | undefined; // Fallback for legacy data
            
            // Debug logging for pin data
            console.log('[ComponentEditor] Pin data debug:', {
              componentId: componentEditor.id,
              hasInstancePinData: !!instancePinData,
              instancePinDataLength: instancePinData?.length,
              instancePinData: instancePinData,
              hasInstancePinNames: !!instancePinNames,
              instancePinNamesLength: instancePinNames?.length,
              instancePinNames: instancePinNames
            });
            // Resolve definition if not provided as prop
            const resolvedDef = componentDefinition || resolveComponentDefinition(comp as any);
            const definitionPinNames = resolvedDef?.properties?.pinNames as string[] | undefined;
            
            // Data-driven: Show Name column if pinNames are defined in the definition
            // OR if pin data exists on the instance (e.g., from AI extraction)
            // If pinNames contains "CHIP_DEPENDENT", use text input (for ICs with custom pin names)
            // Otherwise, use dropdown (for transistors, op amps with predefined names)
            const hasPinNames = definitionPinNames && definitionPinNames.length > 0;
            const hasInstancePinData = (instancePinData && instancePinData.length > 0) || (instancePinNames && instancePinNames.length > 0);
            const isChipDependent = hasPinNames && definitionPinNames.includes('CHIP_DEPENDENT');
            const useDropdown = hasPinNames && !isChipDependent; // Dropdown for predefined names
            const useTextInput = isChipDependent || (!hasPinNames && hasInstancePinData); // Text input for CHIP_DEPENDENT or AI-extracted data
            const showNameColumn = hasPinNames || hasInstancePinData; // Show if definition has pinNames OR instance has pin data
            
            // Check if any pin has type or alternate_functions to determine if we should show those columns
            const hasPinTypes = instancePinData && instancePinData.some(pd => pd && pd.type && pd.type.trim() !== '');
            const hasAlternateFunctions = instancePinData && instancePinData.some(pd => pd && pd.alternate_functions && pd.alternate_functions.length > 0);

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
                    {hasPinTypes && (
                      <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333', width: '80px' }}>Type</th>
                    )}
                    {hasAlternateFunctions && (
                      <th style={{ padding: '2px 4px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#333', width: '120px' }}>Alt Functions</th>
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
                    
                    // Get pin data from instance (preferred) or fallback to pinNames (legacy)
                    const pinDataItem = instancePinData && i < instancePinData.length && instancePinData[i] ? instancePinData[i] : null;
                    const instancePinName = pinDataItem?.name || (instancePinNames && i < instancePinNames.length ? instancePinNames[i] : '');
                    const defaultPinName = definitionPinNames && i < definitionPinNames.length ? definitionPinNames[i] : '';
                    const isChipDependent = defaultPinName === 'CHIP_DEPENDENT';
                    // Use instance value if it exists and is not empty, otherwise use default (unless it's CHIP_DEPENDENT)
                    const currentPinName = (instancePinName && instancePinName.trim() !== '') ? instancePinName : 
                                          (isChipDependent ? '' : defaultPinName);
                    const pinType = pinDataItem?.type;
                    const alternateFunctions = pinDataItem?.alternate_functions;
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
                                    const existingPinData = (currentComp as any).pinData as Array<{ name: string; type?: string; alternate_functions?: string[] }> | undefined;
                                    const existingPinNames = (currentComp as any).pinNames || [];
                                    // Update pinData (preferred) or create from pinNames (legacy)
                                    let newPinData: Array<{ name: string; type?: string; alternate_functions?: string[] }>;
                                    if (existingPinData && Array.isArray(existingPinData)) {
                                      newPinData = [...existingPinData];
                                    } else {
                                      // Create from existing pinNames
                                      newPinData = existingPinNames.map((name: string) => ({ name }));
                                    }
                                    while (newPinData.length < componentEditor.pinCount) {
                                      newPinData.push({ name: '' });
                                    }
                                    // Preserve type and alternate_functions when updating name
                                    newPinData[i] = { ...newPinData[i], name: newPinName };
                                    // Also maintain pinNames for backward compatibility
                                    const newPinNames = newPinData.map(pd => pd.name);
                                    const updatedComp = { ...currentComp, pinData: newPinData, pinNames: newPinNames };
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
                        {hasPinTypes && (
                          <td style={{ padding: '2px 4px', color: '#333', fontSize: '11px' }}>
                            {pinType && pinType.trim() !== '' ? (
                              <span style={{ fontFamily: 'monospace', color: '#666' }}>{pinType}</span>
                            ) : (
                              <span style={{ color: '#ccc' }}>-</span>
                            )}
                          </td>
                        )}
                        {hasAlternateFunctions && (
                          <td style={{ padding: '2px 4px', color: '#333', fontSize: '11px' }}>
                            {alternateFunctions && alternateFunctions.length > 0 ? (
                              <span style={{ fontFamily: 'monospace', color: '#666', fontSize: '10px' }}>
                                {alternateFunctions.join(', ')}
                              </span>
                            ) : (
                              <span style={{ color: '#ccc' }}>-</span>
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
        alignItems: 'center',
        gap: '6px',
        padding: '6px',
        paddingLeft: '24px',
        paddingRight: '24px',
        borderTop: '1px solid #e0e0e0',
        flexShrink: 0,
      }}>
        {/* Cancel and Save buttons - aligned to the right */}
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
    
    {/* AI Settings Dialog - shown when user tries to extract without API key */}
    {showApiKeyDialog && (
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
            setShowApiKeyDialog(false);
            onAiSettingsDialogClose?.();
          }
        }}
      >
        <div
          style={{
            backgroundColor: '#2b2b31',
            borderRadius: 8,
            padding: '24px',
            minWidth: '520px',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '1px solid #1f1f24',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              AI Service Configuration
            </h3>
            <button
              onClick={() => {
                setShowApiKeyDialog(false);
                onAiSettingsDialogClose?.();
              }}
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
            {/* AI Service Provider Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                AI Service Provider:
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value as AIServiceProvider)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  background: '#1f1f24',
                  color: '#fff',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                {AVAILABLE_PROVIDERS.map(provider => (
                  <option key={provider} value={provider}>
                    {SERVICE_INFO[provider].name}
                  </option>
                ))}
              </select>
              <p style={{ margin: '6px 0 0 0', color: '#aaa', fontSize: '12px', lineHeight: '1.4' }}>
                {SERVICE_INFO[selectedProvider].description}
              </p>
            </div>
            
            {/* API Key Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                {SERVICE_INFO[selectedProvider].name} API Key:
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={SERVICE_INFO[selectedProvider].apiKeyPlaceholder}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  background: '#1f1f24',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              <p style={{ margin: '6px 0 0 0', color: '#aaa', fontSize: '12px' }}>
                Get your API key from:{' '}
                <a 
                  href={SERVICE_INFO[selectedProvider].apiKeyHelpUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#4CAF50' }}
                >
                  {SERVICE_INFO[selectedProvider].apiKeyHelpUrl}
                </a>
              </p>
            </div>
            
            {/* Model Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                Model:
              </label>
              <select
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  background: '#1f1f24',
                  color: '#fff',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                {SERVICE_INFO[selectedProvider].models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.description ? `(${model.description})` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Storage Type Selection */}
            <div style={{ marginBottom: '16px', padding: '12px', background: '#1f1f24', borderRadius: '4px', border: '1px solid #444' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                API Key Storage:
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ddd', fontSize: '13px' }}>
                  <input
                    type="radio"
                    name="storageType2"
                    value="sessionStorage"
                    checked={storageType === 'sessionStorage'}
                    onChange={() => setStorageType('sessionStorage')}
                    style={{ cursor: 'pointer' }}
                  />
                  Session Storage
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ddd', fontSize: '13px' }}>
                  <input
                    type="radio"
                    name="storageType2"
                    value="localStorage"
                    checked={storageType === 'localStorage'}
                    onChange={() => setStorageType('localStorage')}
                    style={{ cursor: 'pointer' }}
                  />
                  Local Storage
                </label>
              </div>
              <p style={{ margin: '8px 0 0 0', color: storageType === 'sessionStorage' ? '#4CAF50' : '#ffaa00', fontSize: '12px', lineHeight: '1.4' }}>
                {storageType === 'sessionStorage' 
                  ? '✓ Session Storage: API key is cleared when you close the browser tab (more secure)'
                  : '⚠ Local Storage: API key persists until you remove it (more convenient)'}
              </p>
            </div>
            
            {/* Security Notes */}
            <div style={{ padding: '10px', background: '#1a1a1f', borderRadius: '4px', border: '1px solid #333' }}>
              <p style={{ margin: '0', color: '#aaa', fontSize: '11px', lineHeight: '1.4' }}>
                <strong style={{ color: '#ffaa00' }}>⚠️ Security:</strong> API keys are stored in plain text in browser storage and are accessible via DevTools. Do not use on shared computers. Consider using API key restrictions from your provider.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRemoveApiKey}
              disabled={!hasStoredApiKey}
              style={{
                padding: '8px 16px',
                background: !hasStoredApiKey ? '#444' : '#d32f2f',
                color: '#fff',
                border: '1px solid #666',
                borderRadius: 6,
                cursor: !hasStoredApiKey ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                opacity: !hasStoredApiKey ? 0.5 : 1,
              }}
              title={!hasStoredApiKey ? 'No API key stored' : 'Remove API key'}
            >
              Remove Key
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowApiKeyDialog(false);
                  onAiSettingsDialogClose?.();
                }}
                style={{
                  padding: '8px 16px',
                  background: '#555',
                  color: '#fff',
                  border: '1px solid #666',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSaveApiKey();
                  setShowApiKeyDialog(false);
                  onAiSettingsDialogClose?.();
                }}
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
                Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    
    
    {/* Prompt Dialog - shows and allows editing of the Gemini prompt */}
    {showPromptDialog && (
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
          zIndex: 2000,
        }}
        onClick={(e) => {
          // Close dialog when clicking outside
          if (e.target === e.currentTarget) {
            setShowPromptDialog(false);
          }
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: '20px',
            maxWidth: '90%',
            maxHeight: '90%',
            width: '800px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#333' }}>
              AI Prompt Editor
            </h3>
            <p style={{ margin: '0', fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
              This is the prompt that will be sent to Gemini when you click "Extract Datasheet Information".
              You can customize it for this component. The prompt will be saved with this component and reloaded when you open it again.
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
              Note: The PDF datasheet will be automatically attached to your prompt when extracting information. You can reference it in your prompt as "the attached PDF" or "the datasheet".
            </p>
          </div>
          
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{
              flex: 1,
              minHeight: '400px',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: '13px',
              fontFamily: 'monospace',
              resize: 'vertical',
              color: '#000',
              background: '#fff',
              lineHeight: '1.5',
            }}
            placeholder="Enter your custom prompt here..."
          />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => {
                setShowPromptDialog(false);
              }}
              style={{
                padding: '8px 16px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#333',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Save custom prompt to component
                if (componentEditor && comp) {
                  const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                  const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                  if (currentComp) {
                    const updatedComp = {
                      ...currentComp,
                      componentPropertiesAIPrompt: customPrompt.trim() || undefined, // Remove if empty
                    };
                    
                    if (componentEditor.layer === 'top') {
                      setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                    } else {
                      setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                    }
                    
                    // Also update componentEditor to reflect the change
                    setComponentEditor({
                      ...componentEditor,
                      componentPropertiesAIPrompt: customPrompt.trim() || undefined,
                    });
                  }
                }
                setShowPromptDialog(false);
              }}
              style={{
                padding: '8px 16px',
                background: '#4CAF50',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Save Prompt
            </button>
          </div>
        </div>
      </div>
    )}
    
    <InfoDialog
      visible={infoDialog.visible}
      title={infoDialog.title}
      message={infoDialog.message}
      type={infoDialog.type}
      onClose={() => {
        setInfoDialog({ visible: false, title: '', message: '', type: 'info' });
      }}
    />
    </>
  );
};

