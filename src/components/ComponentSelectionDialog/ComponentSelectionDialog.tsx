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

import React, { useState, useMemo } from 'react';
import { COMPONENT_CATEGORIES, COMPONENT_TYPE_INFO, formatComponentTypeName } from '../../constants';
import { COMPONENT_DESIGNATORS, COMPONENT_LIST } from '../../data/componentDesignators';
import type { ComponentType } from '../../types';
import type { ComponentDefinition } from '../../data/componentDefinitions.d';

export interface ComponentSelectionMetadata {
  componentType: ComponentType;
  designator?: string; // The designator that was selected (e.g., 'PD', 'LED', 'IR')
  subtype?: string; // The subtype (e.g., 'Photodiode', 'LED', 'Infrared', 'Varistor', 'Attenuator', etc.)
  uniqueKey?: string; // Unique identifier for selection (type + subcategory)
  componentDefinition?: ComponentDefinition; // Complete component definition from JSON with fields and properties
}

export interface ComponentSelectionDialogProps {
  visible: boolean;
  selectedLayer: 'top' | 'bottom';
  selectedComponentType: ComponentType | null;
  selectedComponentKey: string | null; // Unique key for the selected entry
  onLayerChange: (layer: 'top' | 'bottom') => void;
  onComponentTypeChange: (componentType: ComponentType, uniqueKey: string, metadata?: ComponentSelectionMetadata) => void;
  onClose: () => void;
}

// Map designators to ComponentType values and determine subtype
const mapDesignatorToMetadata = (designators: string[]): ComponentSelectionMetadata | null => {
  // Create a reverse mapping from designator prefixes to ComponentType
  const designatorToType: Record<string, ComponentType> = {};
  
  Object.entries(COMPONENT_TYPE_INFO).forEach(([type, info]) => {
    info.prefix.forEach(prefix => {
      if (!designatorToType[prefix]) {
        designatorToType[prefix] = type as ComponentType;
      }
    });
  });
  
  // Try to find a matching ComponentType for any of the designators
  for (const designator of designators) {
    if (designatorToType[designator]) {
      const componentType = designatorToType[designator];
      // Determine subtype based on designator
      let subtype: string | undefined;
      if (componentType === 'Diode') {
        if (designator === 'LED') subtype = 'LED';
        else if (designator === 'IR') subtype = 'Infrared';
        else if (designator === 'PD') subtype = 'Photodiode';
        else if (designator === 'D') subtype = 'Standard';
      } else if (componentType === 'VariableResistor') {
        if (designator === 'RV') subtype = 'Varistor';
        else if (designator === 'VR') subtype = 'Potentiometer';
      } else if (componentType === 'GenericComponent') {
        if (designator === 'AT') subtype = 'Attenuator';
        else if (designator === 'CB') subtype = 'CircuitBreaker';
        else if (designator === 'TC') subtype = 'Thermocouple';
        else if (designator === 'TUN') subtype = 'Tuner';
      }
      return { componentType, designator, subtype };
    }
  }
  
  // Special cases for designators that might map to multiple types or need special handling
  // Check more specific designators first
  if (designators.includes('CE')) {
    return { componentType: 'Electrolytic Capacitor', designator: 'CE' };
  }
  if (designators.includes('CF')) {
    return { componentType: 'Film Capacitor', designator: 'CF' };
  }
  if (designators.includes('TR')) {
    return { componentType: 'Transformer', designator: 'TR' };
  }
  if (designators.includes('VR')) {
    return { componentType: 'VariableResistor', designator: 'VR', subtype: 'Potentiometer' };
  }
  if (designators.includes('AT')) {
    return { componentType: 'GenericComponent', designator: 'AT', subtype: 'Attenuator' };
  }
  if (designators.includes('CB')) {
    return { componentType: 'GenericComponent', designator: 'CB', subtype: 'CircuitBreaker' };
  }
  if (designators.includes('TC')) {
    return { componentType: 'GenericComponent', designator: 'TC', subtype: 'Thermocouple' };
  }
  if (designators.includes('TUN')) {
    return { componentType: 'GenericComponent', designator: 'TUN', subtype: 'Tuner' };
  }
  if (designators.includes('LED')) {
    return { componentType: 'Diode', designator: 'LED', subtype: 'LED' };
  }
  if (designators.includes('IR')) {
    return { componentType: 'Diode', designator: 'IR', subtype: 'Infrared' };
  }
  if (designators.includes('PD')) {
    return { componentType: 'Diode', designator: 'PD', subtype: 'Photodiode' };
  }
  if (designators.includes('RV')) {
    return { componentType: 'VariableResistor', designator: 'RV', subtype: 'Varistor' };
  }
  if (designators.includes('RN')) {
    return { componentType: 'ResistorNetwork', designator: 'RN' };
  }
  if (designators.includes('RT')) {
    return { componentType: 'Thermistor', designator: 'RT' };
  }
  if (designators.includes('PS')) {
    return { componentType: 'PowerSupply', designator: 'PS' };
  }
  if (designators.includes('B')) {
    return { componentType: 'Battery', designator: 'B' };
  }
  if (designators.includes('JP')) {
    return { componentType: 'Jumper', designator: 'JP' };
  }
  if (designators.includes('TP')) {
    return { componentType: 'TestPoint', designator: 'TP' };
  }
  if (designators.includes('FB')) {
    return { componentType: 'FerriteBead', designator: 'FB' };
  }
  if (designators.includes('D')) {
    return { componentType: 'Diode', designator: 'D', subtype: 'Standard' };
  }
  if (designators.includes('C')) {
    return { componentType: 'Capacitor', designator: 'C' };
  }
  if (designators.includes('R')) {
    return { componentType: 'Resistor', designator: 'R' };
  }
  if (designators.includes('Q')) {
    return { componentType: 'Transistor', designator: 'Q' };
  }
  if (designators.includes('U')) {
    return { componentType: 'IntegratedCircuit', designator: 'U' };
  }
  if (designators.includes('J')) {
    return { componentType: 'Connector', designator: 'J' };
  }
  if (designators.includes('S')) {
    return { componentType: 'Switch', designator: 'S' };
  }
  if (designators.includes('Z')) {
    return { componentType: 'Diode', designator: 'Z', subtype: 'Zener' };
  }
  if (designators.includes('V') && !designators.includes('VR')) {
    return { componentType: 'VacuumTube', designator: 'V' };
  }
  if (designators.includes('K')) {
    return { componentType: 'Relay', designator: 'K' };
  }
  if (designators.includes('F')) {
    return { componentType: 'Fuse', designator: 'F' };
  }
  if (designators.includes('L')) {
    return { componentType: 'Inductor', designator: 'L' };
  }
  if (designators.includes('M')) {
    return { componentType: 'Motor', designator: 'M' };
  }
  if (designators.includes('X')) {
    return { componentType: 'Crystal', designator: 'X' };
  }
  if (designators.includes('LS')) {
    return { componentType: 'Speaker', designator: 'LS' };
  }
  
  return null;
};

export const ComponentSelectionDialog: React.FC<ComponentSelectionDialogProps> = ({
  visible,
  selectedLayer,
  selectedComponentType: _selectedComponentType,
  selectedComponentKey,
  onLayerChange,
  onComponentTypeChange,
  onClose,
}) => {
  const [searchText, setSearchText] = useState('');
  
  // Helper function to check if search text matches any of the searchable fields
  const matchesSearch = useMemo(() => {
    if (!searchText.trim()) {
      return () => true; // No filter if search is empty
    }
    const searchLower = searchText.toLowerCase();
    
    return (entry: {
      type?: string;
      subcategory?: string;
      designator?: string;
      componentType?: string; // Description from COMPONENT_DESIGNATORS
      designators?: string[]; // Array of designators
      subtype?: string; // Component subtype
    }): boolean => {
      // Search in component type name (e.g., "Diode", "Resistor", "Electrolytic Capacitor")
      // Check both the formatted name and the raw type name to catch all variations
      if (entry.type) {
        const formattedName = formatComponentTypeName(entry.type).toLowerCase();
        const rawTypeName = entry.type.toLowerCase();
        if (formattedName.includes(searchLower) || rawTypeName.includes(searchLower)) {
          return true;
        }
      }
      
      // Search in subcategory/specific type name (e.g., "Schottky", "LED", "Photodiode")
      if (entry.subcategory && entry.subcategory.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in designator(s)
      if (entry.designator && entry.designator.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (entry.designators && entry.designators.some(d => d.toLowerCase().includes(searchLower))) {
        return true;
      }
      
      // Search in description field (from COMPONENT_DESIGNATORS.componentType)
      if (entry.componentType && entry.componentType.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      return false;
    };
  }, [searchText]);
  
  // Filter designators based on search text (search in componentType field, designators, and type names)
  // Must be called before early return to follow Rules of Hooks
  const filteredDesignators = useMemo(() => {
    if (!searchText.trim()) {
      return COMPONENT_DESIGNATORS;
    }
    return COMPONENT_DESIGNATORS.filter(entry => {
      // Check description field
      if (matchesSearch({ componentType: entry.componentType, designators: entry.designators })) {
        return true;
      }
      
      // Also check if any designator maps to a component type that matches
      const metadata = mapDesignatorToMetadata(entry.designators);
      if (metadata) {
        return matchesSearch({
          type: metadata.componentType,
          designator: metadata.designator,
          subtype: metadata.subtype,
        });
      }
      
      return false;
    });
  }, [searchText, matchesSearch]);
  
  if (!visible) return null;

  const dialogStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingRight: '20px',
    paddingTop: '80px',
    zIndex: 10005,
    pointerEvents: 'none',
  };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  };

  return (
    <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          backgroundColor: '#fff',
          borderRadius: 8,
          minWidth: '300px',
          maxWidth: '400px',
          width: 'fit-content',
          maxHeight: '80%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          border: '1px solid #ddd',
          zIndex: 10005,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
        }}
      >
        {/* Fixed header - matches Information dialog style */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '6px',
            borderBottom: '1px solid #e0e0e0',
            background: '#888', // Medium gray background for grabbable window border
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Select Component</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '14px',
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
        <div style={contentStyle}>
          {/* Search Box */}
          <div style={{ marginBottom: '16px' }} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Search by Component Type..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #ddd',
                borderRadius: 4,
                color: '#333',
                backgroundColor: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Layer Selection */}
          <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #eee' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#333' }}>
              Layer:
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                }}
              >
                <input
                  type="radio"
                  name="componentLayer"
                  checked={selectedLayer === 'top'}
                  onChange={() => onLayerChange('top')}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ 
                    marginRight: '8px',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    accentColor: '#0066cc',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    border: selectedLayer === 'top' ? '2px solid #0066cc' : '2px solid #999',
                    borderRadius: '50%',
                    backgroundColor: selectedLayer === 'top' ? '#0066cc' : 'transparent',
                    position: 'relative',
                  }}
                />
                Top
              </label>
              <label
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                }}
              >
                <input
                  type="radio"
                  name="componentLayer"
                  checked={selectedLayer === 'bottom'}
                  onChange={() => onLayerChange('bottom')}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ 
                    marginRight: '8px',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    accentColor: '#0066cc',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    border: selectedLayer === 'bottom' ? '2px solid #0066cc' : '2px solid #999',
                    borderRadius: '50%',
                    backgroundColor: selectedLayer === 'bottom' ? '#0066cc' : 'transparent',
                    position: 'relative',
                  }}
                />
                Bottom
              </label>
            </div>
          </div>

          {/* Component Type Selection - Search results or all choices */}
          <div>
            <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600, color: '#333' }}>
              Component Type:
            </div>
            <div style={{ maxHeight: 'calc(80vh - 280px)', overflowY: 'auto' }}>
              {searchText.trim() ? (
                // Show search results when searching
                filteredDesignators.length > 0 ? (
                  filteredDesignators.map((entry, index) => {
                    const metadata = mapDesignatorToMetadata(entry.designators);
                    // Create unique key for search results: use first designator + component type
                    const uniqueKey = metadata ? `${entry.designators[0]}-${metadata.componentType}` : null;
                    const isSelected = metadata && uniqueKey ? selectedComponentKey === uniqueKey : false;
                    const designatorStr = entry.designators.join(', ');
                    
                    // Find the complete component definition from JSON by designator.
                    // Do NOT require type match here, since legacy componentType strings
                    // (e.g., 'Electrolytic Capacitor') may differ from JSON type ('Capacitor').
                    const componentDef = metadata
                      ? COMPONENT_LIST.find(comp =>
                          comp.designators.includes(metadata.designator || '')
                        )
                      : undefined;
                    
                    // Enhance metadata with component definition
                    const enhancedMetadata = metadata ? {
                      ...metadata,
                      componentDefinition: componentDef
                    } : undefined;
                    
                    return (
                      <label
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (enhancedMetadata && uniqueKey) {
                            onComponentTypeChange(enhancedMetadata.componentType, uniqueKey, enhancedMetadata);
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          marginBottom: '4px',
                          background: isSelected ? '#e6f0ff' : '#fff',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          cursor: metadata ? 'pointer' : 'default',
                          fontSize: '12px',
                          color: metadata ? '#333' : '#999',
                        }}
                      >
                        <input
                          type="radio"
                          name="componentType-search"
                          checked={isSelected}
                          onChange={() => {
                            if (enhancedMetadata && uniqueKey) {
                              onComponentTypeChange(enhancedMetadata.componentType, uniqueKey, enhancedMetadata);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={!metadata}
                          style={{ 
                            marginRight: '10px',
                            width: '20px',
                            height: '20px',
                            cursor: metadata ? 'pointer' : 'default',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            border: isSelected ? '2px solid #0066cc' : '2px solid #999',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#0066cc' : 'transparent',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        />
                        <strong>{designatorStr}</strong> - {entry.componentType}
                        {!metadata && <span style={{ color: '#999', fontSize: '11px', marginLeft: '8px' }}>(Not available)</span>}
                      </label>
                    );
                  })
                ) : (
                  <div style={{ padding: '12px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
                    No matches found for "{searchText}"
                  </div>
                )
              ) : (
                // Show all categories (original view) - each subtype as separate radio button
                // Filter categories based on search text if provided
                Object.entries(COMPONENT_CATEGORIES)
                  .filter(([category]) => {
                    // If search text is provided, filter categories and entries
                    if (!searchText.trim()) return true;
                    // Category name might match
                    if (category.toLowerCase().includes(searchText.toLowerCase())) return true;
                    // Will filter entries below
                    return true;
                  })
                  .map(([category, subcategories]) => {
                  // Create separate entry for each subcategory (no consolidation)
                  const entries: Array<{ type: string; subcategory: string; designator: string; subtype?: string }> = [];
                  
                  Object.entries(subcategories).forEach(([subcategory, types]: [string, readonly string[]]) => {
                    types.forEach((type: string) => {
                      const info = COMPONENT_TYPE_INFO[type as keyof typeof COMPONENT_TYPE_INFO];
                      if (!info) return;
                      
                      // Determine designator and subtype from subcategory
                      let designator = info.prefix[0];
                      let subtype: string | undefined;
                      
                      // Map subcategory names to subtypes and designators
                      if (type === 'Capacitor' || type === 'Electrolytic Capacitor' || type === 'Film Capacitor') {
                        if (subcategory === 'Electrolytic') { designator = 'CE'; }
                        else if (subcategory === 'Film') { designator = 'CF'; }
                        else if (subcategory === 'Tantalum') { designator = 'C'; subtype = 'Tantalum'; }
                        else { designator = 'C'; }
                      } else if (type === 'Diode') {
                        if (subcategory === 'LED') { designator = 'LED'; subtype = 'LED'; }
                        else if (subcategory === 'Infrared') { designator = 'IR'; subtype = 'Infrared'; }
                        else if (subcategory === 'Photodiode') { designator = 'PD'; subtype = 'Photodiode'; }
                        else if (subcategory === 'Schottky') { designator = 'D'; subtype = 'Schottky'; }
                        else { designator = 'D'; subtype = 'Standard'; }
                      } else if (type === 'VariableResistor') {
                        if (subcategory === 'Varistor') { designator = 'RV'; subtype = 'Varistor'; }
                        else { designator = 'VR'; subtype = 'Potentiometer'; }
                      } else if (type === 'GenericComponent') {
                        if (subcategory === 'Attenuator') { designator = 'AT'; subtype = 'Attenuator'; }
                        else if (subcategory === 'Circuit Breaker') { designator = 'CB'; subtype = 'CircuitBreaker'; }
                        else if (subcategory === 'Thermocouple') { designator = 'TC'; subtype = 'Thermocouple'; }
                        else if (subcategory === 'Tuner') { designator = 'TUN'; subtype = 'Tuner'; }
                      } else {
                        // For other types, use the first prefix
                        designator = info.prefix[0];
                      }
                      
                      // Filter by search text if provided
                      // Look up the description from COMPONENT_DESIGNATORS for this designator
                      let description: string | undefined;
                      const designatorEntry = COMPONENT_DESIGNATORS.find(entry => 
                        entry.designators.includes(designator)
                      );
                      if (designatorEntry) {
                        description = designatorEntry.componentType;
                      }
                      
                      if (searchText.trim() && !matchesSearch({ 
                        type, 
                        subcategory, 
                        designator, 
                        subtype,
                        componentType: description, // Include description for search
                        designators: [designator]
                      })) {
                        return; // Skip this entry if it doesn't match search
                      }
                      
                      entries.push({ type, subcategory, designator, subtype });
                    });
                  });

                  // Don't show category if no entries match search
                  if (entries.length === 0) {
                    return null;
                  }
                  
                  return (
                    <div key={category} style={{ marginBottom: '12px' }}>
                      {/* Category header */}
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#333',
                          padding: '6px 8px',
                          marginBottom: '4px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: 4,
                        }}
                      >
                        {category}
                      </div>
                      {/* Each subcategory as separate radio button */}
                      <div style={{ marginLeft: '8px' }}>
                      {entries.map(({ type, subcategory, designator, subtype }, index) => {
                        const info = COMPONENT_TYPE_INFO[type as keyof typeof COMPONENT_TYPE_INFO];
                        if (!info) return null;
                        // Create a unique key for this entry: designator-type or type-subcategory
                        // Use designator-type as it's more specific and handles cases where same type has different designators
                        const uniqueKey = `${designator}-${type}`;
                        // Only this specific entry should be selected, not all entries with the same type
                        const isSelected = selectedComponentKey === uniqueKey;
                        const typeName = formatComponentTypeName(type);
                        
                        // Build display text: designator - typeName or designator - subcategory name
                        let displayText = `${designator} - ${typeName}`;
                        if (subcategory !== 'Standard' && subcategory !== 'General' && subcategory !== typeName) {
                          displayText = `${designator} - ${subcategory}`;
                        }
                        
                        // Find the complete component definition from JSON
                        const componentDef = COMPONENT_LIST.find(comp => 
                          comp.category === category &&
                          comp.subcategory === subcategory &&
                          comp.type === type
                        );
                        
                        // Create metadata object with subtype, designator, and complete definition
                        const metadata: ComponentSelectionMetadata = {
                          componentType: type as ComponentType,
                          designator,
                          subtype,
                          uniqueKey,
                          componentDefinition: componentDef
                        };
                        
                        return (
                          <label
                            key={`${type}-${subcategory}-${index}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onComponentTypeChange(type as ComponentType, uniqueKey, metadata);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 12px',
                              marginBottom: '2px',
                              background: isSelected ? '#e6f0ff' : '#fff',
                              border: '1px solid #ddd',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: '#333',
                            }}
                          >
                            <input
                              type="radio"
                              name={`componentType-${category}`}
                              checked={isSelected}
                              onChange={() => onComponentTypeChange(type as ComponentType, uniqueKey, metadata)}
                              onClick={(e) => {
                                e.stopPropagation();
                                onComponentTypeChange(type as ComponentType, uniqueKey, metadata);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{ 
                                marginRight: '10px',
                                width: '20px',
                                height: '20px',
                                cursor: 'pointer',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                border: isSelected ? '2px solid #0066cc' : '2px solid #999',
                                borderRadius: '50%',
                                backgroundColor: isSelected ? '#0066cc' : 'transparent',
                                position: 'relative',
                                flexShrink: 0,
                              }}
                            />
                            {displayText}
                          </label>
                        );
                      })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



