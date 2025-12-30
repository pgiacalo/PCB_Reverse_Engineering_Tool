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

import React, { useState, useEffect } from 'react';
import type { PCBComponent } from '../../types';
import type { ComponentDefinition } from '../../data/componentDefinitions.d';
import { InfoDialog } from '../InfoDialog/InfoDialog';
import { COMPONENT_TYPE_INFO, formatComponentTypeName } from '../../constants';
import { ComponentTypeFields } from './ComponentTypeFields';
import { resolveComponentDefinition } from '../../utils/componentDefinitionResolver';
import { isComponentPolarized } from '../../utils/components';

// AI Service configuration - supports multiple providers (Gemini, Claude, OpenAI)
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
} from '../../utils/aiServices';

// Run migration on module load to preserve any existing Gemini API keys
if (typeof window !== 'undefined') {
  migrateFromLegacyStorage();
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
  /** External trigger to show Gemini settings dialog */
  showGeminiSettingsDialog?: boolean;
  /** Callback when Gemini settings dialog is closed */
  onGeminiSettingsDialogClose?: () => void;
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
  showGeminiSettingsDialog = false,
  onGeminiSettingsDialogClose,
  onFindComponent,
  canvasHeight,
}) => {
  const [isFetchingPinNames, setIsFetchingPinNames] = useState(false);
  const [uploadedDatasheetFile, setUploadedDatasheetFile] = useState<File | null>(null);
  const [showApiKeyInstructions, setShowApiKeyInstructions] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [aiRawResponse, setAiRawResponse] = useState<string | null>(null);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  // AI Service state - supports multiple providers
  const [selectedProvider, setSelectedProvider] = useState<AIServiceProvider>(() => {
    if (typeof window !== 'undefined') {
      return getAIConfig().provider;
    }
    return 'gemini';
  });
  
  // API key input state - must be at top level (React Rules of Hooks)
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const service = getCurrentService();
      return service.getApiKey() || '';
    }
    return '';
  });
  
  // Model selection state
  const [modelInput, setModelInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const service = getCurrentService();
      return service.getModel();
    }
    return 'gemini-2.0-flash';
  });
  
  // API key storage type (sessionStorage or localStorage)
  const [storageType, setStorageType] = useState<APIKeyStorageType>(() => {
    if (typeof window !== 'undefined') {
      return getApiKeyStorageType();
    }
    return 'sessionStorage';
  });
  
  // Check if API key exists for current provider (for Remove button state)
  const [hasStoredApiKey, setHasStoredApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return getCurrentService().hasApiKey();
    }
    return false;
  });

  // Handle external trigger to show AI settings dialog
  useEffect(() => {
    if (showGeminiSettingsDialog) {
      // Reload all settings when dialog opens
      if (typeof window !== 'undefined') {
        const config = getAIConfig();
        setSelectedProvider(config.provider);
        setStorageType(config.apiKeyStorageType);
        
        const service = getCurrentService();
        const savedKey = service.getApiKey();
        const savedModel = service.getModel();
        
        setApiKeyInput(savedKey || '');
        setModelInput(savedModel);
        setHasStoredApiKey(!!savedKey);
      }
      // Use a small timeout to ensure state updates properly
      const timer = setTimeout(() => {
        setShowApiKeyDialog(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showGeminiSettingsDialog]);

  // Update hasStoredApiKey when provider changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const service = getCurrentService();
      setHasStoredApiKey(service.hasApiKey() || !!apiKeyInput.trim());
    }
  }, [apiKeyInput, selectedProvider]);

  // Load custom prompt from component when editor opens
  useEffect(() => {
    if (componentEditor) {
      const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
      const currentComp = currentCompList.find(c => c.id === componentEditor.id);
      if (currentComp) {
        const customPromptValue = (currentComp as any).customGeminiPrompt;
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
      // Save the provider and storage type preference
      saveAIConfig({
        provider: selectedProvider,
        model: modelInput,
        apiKeyStorageType: storageType,
      });
      setApiKeyStorageType(storageType);
      setCurrentProvider(selectedProvider);
      
      const service = getCurrentService();
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

  // Function to build the default Gemini prompt dynamically based on component fields
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
5. For IC Type (icType), determine the type of integrated circuit from the datasheet. Choose from: "Op-Amp", "Microcontroller", "Microprocessor", "Logic", "Memory", "Voltage Regulator", "Timer", "ADC", "DAC", "Comparator", "Transceiver", "Driver", "Amplifier", or "Other". If it's clearly an op amp, use "Op-Amp". If it's clearly a microcontroller, use "Microcontroller", etc.
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
    onShowResponse?: () => void;
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
                onGeminiSettingsDialogClose?.();
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
                    onGeminiSettingsDialogClose?.();
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
                <p style={{ margin: '0 0 16px 0' }}>
                  Extract datasheet information for components — avoiding manual data entry. Choose your preferred AI service below.
                </p>
                
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
                    onGeminiSettingsDialogClose?.();
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
                    onGeminiSettingsDialogClose?.();
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
          onShowResponse={infoDialog.onShowResponse}
        />
      </>
    );
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
    
    // Update type-specific fields based on component type
    // Save separate value and unit fields
    // Note: Preserve empty strings explicitly (don't convert to undefined) so values are retained
    if (comp.componentType === 'Resistor') {
      (updated as any).resistance = componentEditor.resistance !== undefined ? componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit !== undefined ? componentEditor.resistanceUnit : undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).tolerance = componentEditor.tolerance !== undefined ? componentEditor.tolerance : undefined;
    } else if (comp.componentType === 'Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance !== undefined ? componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit !== undefined ? componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = componentEditor.tolerance !== undefined ? componentEditor.tolerance : undefined;
      (updated as any).dielectric = componentEditor.dielectric !== undefined ? componentEditor.dielectric : undefined;
    } else if (comp.componentType === 'Electrolytic Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance !== undefined ? componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit !== undefined ? componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = componentEditor.tolerance !== undefined ? componentEditor.tolerance : undefined;
      // polarized is now a fixed property from definition, not user-editable
      (updated as any).esr = componentEditor.esr !== undefined ? componentEditor.esr : undefined;
      (updated as any).esrUnit = componentEditor.esrUnit !== undefined ? componentEditor.esrUnit : undefined;
      (updated as any).temperature = componentEditor.temperature !== undefined ? componentEditor.temperature : undefined;
    } else if (comp.componentType === 'Film Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance !== undefined ? componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit !== undefined ? componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = componentEditor.tolerance !== undefined ? componentEditor.tolerance : undefined;
      (updated as any).filmType = componentEditor.filmType || undefined;
    } else if (comp.componentType === 'Diode') {
      // Pre-fill diodeType from component's diodeType property (set during creation from radio button selection)
      (updated as any).diodeType = componentEditor.diodeType || (comp as any).diodeType || 'Standard';
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
      (updated as any).ledColor = componentEditor.ledColor !== undefined ? componentEditor.ledColor : undefined;
    } else if (comp.componentType === 'Battery') {
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).capacity = componentEditor.capacity !== undefined ? componentEditor.capacity : undefined;
      (updated as any).capacityUnit = componentEditor.capacityUnit !== undefined ? componentEditor.capacityUnit : undefined;
      (updated as any).chemistry = componentEditor.chemistry !== undefined ? componentEditor.chemistry : undefined;
    } else if (comp.componentType === 'Fuse') {
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).fuseType = componentEditor.fuseType !== undefined ? componentEditor.fuseType : undefined;
    } else if (comp.componentType === 'FerriteBead') {
      (updated as any).impedance = componentEditor.impedance !== undefined ? componentEditor.impedance : undefined;
      (updated as any).impedanceUnit = componentEditor.impedanceUnit !== undefined ? componentEditor.impedanceUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'Connector') {
      (updated as any).connectorType = componentEditor.connectorType || undefined;
      (updated as any).gender = componentEditor.gender || undefined;
    } else if (comp.componentType === 'Jumper') {
      (updated as any).positions = componentEditor.positions || undefined;
    } else if (comp.componentType === 'Relay') {
      (updated as any).coilVoltage = componentEditor.coilVoltage !== undefined ? componentEditor.coilVoltage : undefined;
      (updated as any).coilVoltageUnit = componentEditor.coilVoltageUnit !== undefined ? componentEditor.coilVoltageUnit : undefined;
      (updated as any).contactType = componentEditor.contactType !== undefined ? componentEditor.contactType : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'Inductor') {
      (updated as any).inductance = componentEditor.inductance !== undefined ? componentEditor.inductance : undefined;
      (updated as any).inductanceUnit = componentEditor.inductanceUnit !== undefined ? componentEditor.inductanceUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
      (updated as any).resistance = componentEditor.resistance !== undefined ? componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit !== undefined ? componentEditor.resistanceUnit : undefined;
    } else if (comp.componentType === 'Speaker') {
      (updated as any).impedance = componentEditor.impedance !== undefined ? componentEditor.impedance : undefined;
      (updated as any).impedanceUnit = componentEditor.impedanceUnit !== undefined ? componentEditor.impedanceUnit : undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
    } else if (comp.componentType === 'Motor') {
      (updated as any).motorType = componentEditor.motorType !== undefined ? componentEditor.motorType : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'PowerSupply') {
      (updated as any).inputVoltage = componentEditor.inputVoltage !== undefined ? componentEditor.inputVoltage : undefined;
      (updated as any).inputVoltageUnit = componentEditor.inputVoltageUnit !== undefined ? componentEditor.inputVoltageUnit : undefined;
      (updated as any).outputVoltage = componentEditor.outputVoltage !== undefined ? componentEditor.outputVoltage : undefined;
      (updated as any).outputVoltageUnit = componentEditor.outputVoltageUnit !== undefined ? componentEditor.outputVoltageUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'Transistor') {
      (updated as any).transistorType = componentEditor.transistorType !== undefined ? componentEditor.transistorType : undefined;
      (updated as any).polarity = componentEditor.polarity !== undefined ? componentEditor.polarity : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
    } else if (comp.componentType === 'ResistorNetwork') {
      (updated as any).resistance = componentEditor.resistance !== undefined ? componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit !== undefined ? componentEditor.resistanceUnit : undefined;
      (updated as any).configuration = componentEditor.configuration || undefined;
    } else if (comp.componentType === 'Thermistor') {
      (updated as any).resistance = componentEditor.resistance !== undefined ? componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit !== undefined ? componentEditor.resistanceUnit : undefined;
      (updated as any).thermistorType = componentEditor.thermistorType || undefined;
      (updated as any).beta = componentEditor.beta || undefined;
    } else if (comp.componentType === 'Switch') {
      (updated as any).switchType = componentEditor.switchType !== undefined ? componentEditor.switchType : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
    } else if (comp.componentType === 'Transformer') {
      (updated as any).primaryVoltage = componentEditor.primaryVoltage !== undefined ? componentEditor.primaryVoltage : undefined;
      (updated as any).primaryVoltageUnit = componentEditor.primaryVoltageUnit !== undefined ? componentEditor.primaryVoltageUnit : undefined;
      (updated as any).secondaryVoltage = componentEditor.secondaryVoltage !== undefined ? componentEditor.secondaryVoltage : undefined;
      (updated as any).secondaryVoltageUnit = componentEditor.secondaryVoltageUnit !== undefined ? componentEditor.secondaryVoltageUnit : undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).turns = componentEditor.turns || undefined;
    } else if (comp.componentType === 'TestPoint') {
      (updated as any).signal = componentEditor.signal || undefined;
    } else if ((comp.componentType as string) === 'Film Capacitor') {
      (updated as any).capacitance = componentEditor.capacitance !== undefined ? componentEditor.capacitance : undefined;
      (updated as any).capacitanceUnit = componentEditor.capacitanceUnit !== undefined ? componentEditor.capacitanceUnit : undefined;
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).tolerance = componentEditor.tolerance !== undefined ? componentEditor.tolerance : undefined;
      (updated as any).filmType = componentEditor.filmType || undefined;
    } else if (comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') {
      // For ICs, save description from the Description field
      // Handle both 'IntegratedCircuit' and legacy 'Semiconductor' componentType
      updated.description = componentEditor.description?.trim() || undefined;
      
      // Ensure componentType is set correctly (fix legacy 'Semiconductor' to 'IntegratedCircuit')
      if ((comp as any).componentType === 'Semiconductor') {
        updated.componentType = 'IntegratedCircuit';
      }
      updated.icType = componentEditor.icType || undefined;
      
      // Save manufacturer, part number, operating temperature, and package type for Integrated Circuits
      (updated as any).manufacturer = componentEditor.manufacturer?.trim() || undefined;
      (updated as any).partNumber = componentEditor.partNumber?.trim() || undefined;
      (updated as any).operatingTemperature = (componentEditor as any).operatingTemperature?.trim() || undefined;
      (updated as any).packageType = (componentEditor as any).packageType || undefined;
      
      // Save uploaded datasheet file path (relative to project root, e.g., "datasheets/filename.pdf")
      // The path is stored in componentEditor.datasheetFileName when file is selected
      if (componentEditor.datasheetFileName) {
        // Keep the full path (e.g., "datasheets/filename.pdf" or just "filename.pdf" for root)
        (updated as any).datasheetFileName = componentEditor.datasheetFileName;
      } else {
        // Clear file path if explicitly removed
        (updated as any).datasheetFileName = undefined;
      }
    } else {
      // For non-IC components, save description from the Description field
      (updated as any).description = componentEditor.description?.trim() || undefined;
    }
    
    if (comp.componentType === 'VacuumTube') {
      (updated as any).tubeType = componentEditor.tubeType || undefined;
    } else if (comp.componentType === 'VariableResistor') {
      (updated as any).vrType = componentEditor.vrType !== undefined ? componentEditor.vrType : undefined;
      (updated as any).resistance = componentEditor.resistance !== undefined ? componentEditor.resistance : undefined;
      (updated as any).resistanceUnit = componentEditor.resistanceUnit !== undefined ? componentEditor.resistanceUnit : undefined;
      // Power is stored as combined value+unit (e.g., "1/4W", "1W") since unit is always W
      (updated as any).power = componentEditor.power ? `${componentEditor.power}W` : undefined;
      (updated as any).taper = componentEditor.taper || undefined;
    } else if (comp.componentType === 'Crystal') {
      (updated as any).frequency = componentEditor.frequency !== undefined ? componentEditor.frequency : undefined;
      (updated as any).loadCapacitance = componentEditor.loadCapacitance !== undefined ? componentEditor.loadCapacitance : undefined;
      (updated as any).tolerance = componentEditor.tolerance !== undefined ? componentEditor.tolerance : undefined;
    } else if (comp.componentType === 'GenericComponent') {
      (updated as any).genericType = componentEditor.genericType || 'Attenuator';
      (updated as any).voltage = componentEditor.voltage !== undefined ? componentEditor.voltage : undefined;
      (updated as any).voltageUnit = componentEditor.voltageUnit !== undefined ? componentEditor.voltageUnit : undefined;
      (updated as any).current = componentEditor.current !== undefined ? componentEditor.current : undefined;
      (updated as any).currentUnit = componentEditor.currentUnit !== undefined ? componentEditor.currentUnit : undefined;
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

      // Use custom prompt if available, otherwise build default prompt
      let prompt: string;
      const componentCustomPrompt = (currentComp as any).customGeminiPrompt;
      if (componentCustomPrompt && componentCustomPrompt.trim()) {
        // Use custom prompt as-is (no text replacement needed with PDF submission)
        prompt = componentCustomPrompt;
      } else {
        // Build default prompt (references attached PDF instead of embedded text)
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
        setAiRawResponse(null);
        throw new Error(aiResponse.error || `${serviceInfo.name} API error`);
      }

      let responseText = aiResponse.text || '';
      
      if (!responseText) {
        setAiRawResponse(null);
        throw new Error(`No response text from ${serviceInfo.name} API. The API may have returned an empty response.`);
      }

      // Store raw response for error display
      const rawResponseText = responseText;
      setAiRawResponse(rawResponseText);

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
      
      if (extractedData.pins && Array.isArray(extractedData.pins)) {
        for (const pin of extractedData.pins) {
          if (pin && typeof pin === 'object' && pin.pinNumber && pin.pinName) {
            const pinNum = parseInt(String(pin.pinNumber), 10);
            if (!isNaN(pinNum) && pinNum >= 1 && pinNum <= extractedPinCount) {
              const pinIndex = pinNum - 1;
              pinData[pinIndex] = {
                name: String(pin.pinName).trim(),
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
      
      // Also maintain pinNames array for backward compatibility (extract names from pinData)
      const pinNames: string[] = pinData.map(pd => pd.name);

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
          const validIcTypes = ['Op-Amp', 'Microcontroller', 'Microprocessor', 'Logic', 'Memory', 'Voltage Regulator', 'Timer', 'ADC', 'DAC', 'Comparator', 'Transceiver', 'Driver', 'Amplifier', 'Other'];
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
        
        // Ensure pinData array matches pin count
        const adjustedPinData = [...pinData];
        while (adjustedPinData.length < extractedPinCount) {
          adjustedPinData.push({ name: '' });
        }
        
        // Also maintain pinNames array for backward compatibility
        const adjustedPinNames = adjustedPinData.map(pd => pd.name);
        
        const updatedComp = { 
          ...currentComp, 
          pinData: adjustedPinData,
          pinNames: adjustedPinNames, // Keep for backward compatibility
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
        
        // Add formatted list of extracted properties if any
        if (extractedPropertiesList.length > 0) {
          message += '\n\nExtracted Properties:';
          extractedPropertiesList.forEach(prop => {
            message += `\n  • ${prop.label}: ${prop.value}`;
          });
        }
        
        // Add pin names list below all other properties
        const pinNamesList: string[] = [];
        pinNames.forEach((name, index) => {
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
        // Clear raw response on success
        setAiRawResponse(null);
      }
    } catch (error) {
      console.error('Error fetching pin names:', error);
      setInfoDialog({
        visible: true,
        title: 'Extraction Failed',
        message: `Failed to extract information: ${error instanceof Error ? error.message : 'Unknown error'}. Please enter pin names manually.`,
        type: 'info',
        onShowResponse: aiRawResponse ? () => setShowResponseDialog(true) : undefined,
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
        
        {/* Datasheet section - moved to top for semiconductors/ICs */}
        {(comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') && (
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
                    const datasheetPath = (comp as any)?.datasheetFileName;
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
                      } else {
                        // Only filename/path is stored - show static text with note to re-choose
                        return (
                          <span 
                            style={{ 
                              fontSize: '11px', 
                              color: '#666', 
                              flex: '0 0 auto',
                              fontStyle: 'italic'
                            }}
                            title="Re-choose the datasheet file to open it"
                          >
                            {fileName} (re-choose file to open)
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
                          
                          // If there's a custom prompt, use it; otherwise build default (with placeholder for datasheet text)
                          const componentCustomPrompt = (currentComp as any).customGeminiPrompt;
                          if (componentCustomPrompt && componentCustomPrompt.trim()) {
                            setCustomPrompt(componentCustomPrompt);
                          } else {
                            // Build default prompt (references attached PDF)
                            const defaultPrompt = buildDefaultPrompt(fieldsToExtract);
                            setCustomPrompt(defaultPrompt);
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
            
            {/* IC Properties section - Pin Count, Manufacturer, Part Number for Integrated Circuits */}
            {(comp.componentType === 'IntegratedCircuit' || (comp as any).componentType === 'Semiconductor') && (
              <>
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0', fontSize: '11px', fontWeight: 600, color: '#000', marginBottom: '4px' }}>IC Properties:</div>
                
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
                  />
                </div>
                
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
              </>
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
        gap: '6px',
        padding: '6px',
        paddingRight: '24px',
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
            onGeminiSettingsDialogClose?.();
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
                onGeminiSettingsDialogClose?.();
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
            <p style={{ margin: '0 0 16px 0' }}>
              Extract datasheet information for components — avoiding manual data entry. Choose your preferred AI service below.
            </p>
            
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
                  onGeminiSettingsDialogClose?.();
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
                  onGeminiSettingsDialogClose?.();
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
    
    {/* AI Response Dialog - shows full API response for debugging */}
    {showResponseDialog && aiRawResponse && (
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
          zIndex: 10006,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowResponseDialog(false);
          }
        }}
      >
        <div
          style={{
            backgroundColor: '#2b2b31',
            borderRadius: 8,
            padding: '24px',
            minWidth: '600px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '2px solid #2196F3',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              AI Service Response
            </h3>
            <button
              onClick={() => {
                setShowResponseDialog(false);
                setAiRawResponse(null);
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
          
          <div style={{ 
            marginBottom: '20px', 
            color: '#ddd', 
            fontSize: '13px', 
            lineHeight: '1.6',
            overflow: 'auto',
            flex: 1,
            padding: '12px',
            background: '#1f1f24',
            borderRadius: '4px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '60vh',
          }}>
            {aiRawResponse}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(aiRawResponse || '');
                alert('Response copied to clipboard');
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
              Copy to Clipboard
            </button>
            <button
              onClick={() => {
                setShowResponseDialog(false);
                setAiRawResponse(null);
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
              Close
            </button>
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
                      customGeminiPrompt: customPrompt.trim() || undefined, // Remove if empty
                    };
                    
                    if (componentEditor.layer === 'top') {
                      setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                    } else {
                      setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                    }
                    
                    // Also update componentEditor to reflect the change
                    setComponentEditor({
                      ...componentEditor,
                      customGeminiPrompt: customPrompt.trim() || undefined,
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
        // Clear raw response when dialog is closed (unless showing response)
        if (!showResponseDialog) {
          setAiRawResponse(null);
        }
      }}
      onShowResponse={infoDialog.onShowResponse}
    />
    </>
  );
};

