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

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { formatComponentTypeName } from '../../constants';
import { COMPONENT_LIST } from '../../data/componentDesignators';
import type { ComponentType } from '../../types';
import type { ComponentDefinition } from '../../data/componentDefinitions.d';
import type { DataDrivenComponentDefinition } from '../../dataDrivenComponents/definitions/schema';
import { getDefinitionByKey } from '../../dataDrivenComponents/definitions/loader';

export interface ComponentSelectionMetadata {
  componentType: ComponentType;
  designator?: string; // The designator that was selected (e.g., 'PD', 'LED', 'IR')
  subtype?: string; // The subtype (e.g., 'Photodiode', 'LED', 'Infrared', 'Varistor', 'Attenuator', etc.)
  uniqueKey?: string; // Unique identifier for selection (type + subcategory)
  componentDefinition?: ComponentDefinition; // Complete legacy component definition from JSON with fields and properties
  /**
   * Data-driven definition used by the v2 runtime.
   * This is the single source of truth for instance creation and designator assignment.
   */
  dataDrivenDefinition?: DataDrivenComponentDefinition;
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

// Derive ComponentType and subtype for a given JSON definition.
// All mapping logic from categories/subcategories to ComponentType lives here.
const buildMetadataForDefinition = (def: ComponentDefinition): ComponentSelectionMetadata => {
  const { category, subcategory, type, designator } = def;

  let componentType: ComponentType;
      let subtype: string | undefined;

  switch (category) {
    case 'Capacitors':
      if (subcategory === 'Electrolytic') {
        componentType = 'Electrolytic Capacitor';
      } else if (subcategory === 'Film') {
        componentType = 'Film Capacitor';
      } else {
        componentType = 'Capacitor';
        if (subcategory === 'Tantalum') {
          subtype = 'Tantalum';
        }
      }
      break;

    case 'Diodes':
      componentType = 'Diode';
      if (subcategory === 'LED') subtype = 'LED';
      else if (subcategory === 'Infrared') subtype = 'Infrared';
      else if (subcategory === 'Photodiode') subtype = 'Photodiode';
      else if (subcategory === 'Schottky') subtype = 'Schottky';
      else if (subcategory === 'Zener') subtype = 'Zener';
      else subtype = 'Standard';
      break;

    case 'Resistors':
      if (subcategory === 'Network') {
        componentType = 'ResistorNetwork';
        subtype = 'Network';
      } else if (subcategory === 'Thermistor') {
        componentType = 'Thermistor';
        subtype = 'Thermistor';
      } else if (subcategory === 'Variable') {
        componentType = 'VariableResistor';
        subtype = 'Potentiometer';
      } else if (subcategory === 'Varistor') {
        componentType = 'VariableResistor';
        subtype = 'Varistor';
      } else {
        componentType = 'Resistor';
      }
      break;

    case 'Semiconductors':
      if (subcategory === 'BJT' || subcategory === 'MOSFET' || subcategory === 'JFET') {
        componentType = 'Transistor';
      } else if (subcategory === 'Single Op Amp' || subcategory === 'Dual Op Amp') {
        componentType = 'IntegratedCircuit';
      } else {
        componentType = 'IntegratedCircuit';
  }
      break;

    case 'Passive Components':
      if (type === 'Inductor') componentType = 'Inductor';
      else if (type === 'FerriteBead') componentType = 'FerriteBead';
      else componentType = 'Crystal';
      break;

    case 'Power & Energy':
      if (subcategory === 'Battery') componentType = 'Battery';
      else if (subcategory === 'Power Supply') componentType = 'PowerSupply';
      else componentType = 'Fuse';
      break;

    case 'Connectors & Switches':
      if (subcategory === 'Connector') componentType = 'Connector';
      else if (subcategory === 'Jumper') componentType = 'Jumper';
      else if (subcategory === 'Switch') componentType = 'Switch';
      else componentType = 'Relay';
      break;

    case 'Other':
      if (subcategory === 'Transformer') componentType = 'Transformer';
      else if (subcategory === 'Speaker') componentType = 'Speaker';
      else if (subcategory === 'Motor') componentType = 'Motor';
      else if (subcategory === 'Test Point') componentType = 'TestPoint';
      else if (subcategory === 'Vacuum Tube') componentType = 'VacuumTube';
      else {
        componentType = 'GenericComponent';
        if (subcategory === 'Attenuator') subtype = 'Attenuator';
        else if (subcategory === 'Circuit Breaker') subtype = 'CircuitBreaker';
        else if (subcategory === 'Thermocouple') subtype = 'Thermocouple';
        else if (subcategory === 'Tuner') subtype = 'Tuner';
  }
      break;

    default:
      componentType = 'GenericComponent';
      break;
  }

  const uniqueKey = `${category}:${subcategory}:${type}:${designator}`;
  const v2Key = `${category}:${subcategory}:${type}`;
  const dataDrivenDefinition = getDefinitionByKey(v2Key);

  return {
    componentType,
    designator,
    subtype,
    uniqueKey,
    componentDefinition: def,
    dataDrivenDefinition: dataDrivenDefinition,
  };
};

// Pre-group components by category for the non-search view
const COMPONENTS_BY_CATEGORY: Record<string, ComponentDefinition[]> = COMPONENT_LIST.reduce(
  (acc, def) => {
    if (!acc[def.category]) {
      acc[def.category] = [];
  }
    acc[def.category].push(def);
    return acc;
  },
  {} as Record<string, ComponentDefinition[]>
);

// Sort entries within each category by displayName (what the user actually sees)
Object.values(COMPONENTS_BY_CATEGORY).forEach(list => {
  list.sort((a, b) => a.displayName.localeCompare(b.displayName));
});

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
  // Dialog position and dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize position when dialog becomes visible
  useEffect(() => {
    if (visible && position === null) {
      // Position dialog at the upper left of the canvas
      const canvas = document.querySelector('.pcb-canvas') as HTMLCanvasElement;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setPosition({
          x: rect.left,
          y: rect.top,
        });
      } else {
        // Fallback: use known canvas position (left: 244px, top: 6px)
        setPosition({
          x: 244,
          y: 6,
        });
      }
    }
  }, [visible, position]);

  // Auto-focus search input when dialog opens
  useEffect(() => {
    if (visible && searchInputRef.current) {
      // Small delay to ensure dialog is fully rendered
      const timeoutId = setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [visible]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only start dragging if clicking on the header (not buttons/inputs)
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
      return;
    }
    if (dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setIsDragging(true);
      e.preventDefault();
    }
  }, []);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      // Keep dialog within viewport bounds
      const dialogWidth = dialogRef.current?.offsetWidth || 400;
      const dialogHeight = dialogRef.current?.offsetHeight || 600;
      
      const clampedX = Math.max(0, Math.min(newX, window.innerWidth - dialogWidth));
      const clampedY = Math.max(0, Math.min(newY, window.innerHeight - dialogHeight));
      
      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Helper function to check if search text matches any of the searchable fields
  // Uses searchText field from component definition as the primary search source
  const matchesSearch = useMemo(() => {
    if (!searchText.trim()) {
      return () => true; // No filter if search is empty
    }
    const searchLower = searchText.toLowerCase();
    
    return (entry: {
      category?: string;
      type?: string;
      subcategory?: string;
      designator?: string;
      displayName?: string;
      description?: string;
      resolvedTypeName?: string;
      searchText?: string; // Primary search field from component definition
    }): boolean => {
      // Primary: Search in searchText field (contains all searchable terms)
      if (entry.searchText && entry.searchText.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Fallback: Search in display name (e.g., "Resistor Network", "Power Supply")
      if (entry.displayName && entry.displayName.toLowerCase().includes(searchLower)) {
          return true;
        }

      // Fallback: Search in description text
      if (entry.description && entry.description.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Fallback: Search in category and subcategory names
      if (entry.category && entry.category.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (entry.subcategory && entry.subcategory.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Fallback: Search in designator(s)
      if (entry.designator && entry.designator.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Fallback: Search in raw type or resolved ComponentType name
      if (entry.type && entry.type.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (entry.resolvedTypeName && entry.resolvedTypeName.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      return false;
    };
  }, [searchText]);
  
  // Filter component definitions based on search text
  // Must be called before early return to follow Rules of Hooks
  const filteredComponents = useMemo(() => {
    if (!searchText.trim()) {
      return COMPONENT_LIST;
    }

    return COMPONENT_LIST.filter(def => {
      const meta = buildMetadataForDefinition(def);
        return matchesSearch({
        category: def.category,
        type: meta.componentType,
        subcategory: def.subcategory,
        designator: def.designator,
        displayName: def.displayName,
        description: def.description,
        resolvedTypeName: formatComponentTypeName(meta.componentType),
        searchText: def.searchText, // Primary search field from component definition
        });
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
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: position ? `${position.y}px` : undefined,
          left: position ? `${position.x}px` : undefined,
          backgroundColor: '#fff',
          borderRadius: 8,
          minWidth: '250px',
          maxWidth: '300px',
          width: '280px',
          maxHeight: '80%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          border: '1px solid #ddd',
          zIndex: 10005,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          transform: 'none', // Position from top-left corner, not centered
        }}
      >
        {/* Fixed header - draggable title bar */}
        <div 
          onMouseDown={handleDragStart}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '6px',
            borderBottom: '1px solid #e0e0e0',
            background: '#888', // Medium gray background for grabbable window border
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Select Component</h2>
          <button
            type="button"
            onMouseDown={(e) => {
              // Prevent drag behavior when clicking the close button
              e.stopPropagation();
            }}
            onClick={(e) => {
              // Ensure the click does not get interpreted as a drag and reliably closes the dialog
              e.stopPropagation();
              onClose();
            }}
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
              ref={searchInputRef}
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
                    width: '14px',
                    height: '14px',
                    cursor: 'pointer',
                    accentColor: '#0066cc',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    border: selectedLayer === 'top' ? '1.5px solid #0066cc' : '1.5px solid #999',
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
                    width: '14px',
                    height: '14px',
                    cursor: 'pointer',
                    accentColor: '#0066cc',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    border: selectedLayer === 'bottom' ? '1.5px solid #0066cc' : '1.5px solid #999',
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
                filteredComponents.length > 0 ? (
                  filteredComponents.map((def) => {
                    const metadata = buildMetadataForDefinition(def);
                    const uniqueKey = metadata.uniqueKey || `${def.category}:${def.subcategory}:${def.type}:${def.designator}`;
                    const isSelected = selectedComponentKey === uniqueKey;
                    const labelText = `${def.designator} - ${def.displayName}`;
                    
                    return (
                      <label
                        key={uniqueKey}
                        onClick={(e) => {
                          e.stopPropagation();
                          onComponentTypeChange(metadata.componentType, uniqueKey, metadata);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          maxWidth: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          marginBottom: '4px',
                          background: isSelected ? '#e6f0ff' : '#fff',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#333',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                        }}
                      >
                        <input
                          type="radio"
                          name="componentType-search"
                          checked={isSelected}
                          onChange={() => onComponentTypeChange(metadata.componentType, uniqueKey, metadata)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{ 
                            marginRight: '8px',
                            width: '14px',
                            height: '14px',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            border: isSelected ? '1.5px solid #0066cc' : '1.5px solid #999',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#0066cc' : 'transparent',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                        }}>
                          <strong>{labelText}</strong>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ padding: '12px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
                    No matches found for "{searchText}"
                  </div>
                )
              ) : (
                // Show all categories (original view) - each definition as a separate radio button
                Object.entries(COMPONENTS_BY_CATEGORY).map(([category, defs]) => {
                  if (defs.length === 0) return null;
                  
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
                      {/* Each component definition as a separate radio button */}
                      <div style={{ marginLeft: '8px' }}>
                        {defs.map((def) => {
                          const metadata = buildMetadataForDefinition(def);
                          const uniqueKey = metadata.uniqueKey || `${def.category}:${def.subcategory}:${def.type}:${def.designator}`;
                        const isSelected = selectedComponentKey === uniqueKey;
                          const displayText = `${def.designator} - ${def.displayName}`;
                        
                        return (
                          <label
                              key={uniqueKey}
                            onClick={(e) => {
                              e.stopPropagation();
                                onComponentTypeChange(metadata.componentType, uniqueKey, metadata);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              maxWidth: '100%',
                              textAlign: 'left',
                              padding: '6px 12px',
                              marginBottom: '2px',
                              background: isSelected ? '#e6f0ff' : '#fff',
                              border: '1px solid #ddd',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: '#333',
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                            }}
                          >
                            <input
                              type="radio"
                              name={`componentType-${category}`}
                              checked={isSelected}
                                onChange={() => onComponentTypeChange(metadata.componentType, uniqueKey, metadata)}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{ 
                                marginRight: '8px',
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                border: isSelected ? '1.5px solid #0066cc' : '1.5px solid #999',
                                borderRadius: '50%',
                                backgroundColor: isSelected ? '#0066cc' : 'transparent',
                                position: 'relative',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}>
                              {displayText}
                            </span>
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



