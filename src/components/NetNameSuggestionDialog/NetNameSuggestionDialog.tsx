/**
 * Dialog for reviewing and approving AI-suggested net names
 */

import React, { useState, useRef } from 'react';
import type { NetNameSuggestion } from '../../utils/netNameInference';

interface NetNameSuggestionDialogProps {
  suggestions: NetNameSuggestion[];
  onApply: (selectedSuggestions: NetNameSuggestion[]) => void;
  onCancel: () => void;
  position: { x: number; y: number };
  onDragStart: (e: React.MouseEvent) => void;
}

export const NetNameSuggestionDialog: React.FC<NetNameSuggestionDialogProps> = ({
  suggestions,
  onApply,
  onCancel,
  position,
  onDragStart
}) => {
  // Track which suggestions are selected (all selected by default if confidence >= 0.7)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(
    new Set(suggestions.filter(s => s.confidence >= 0.7).map(s => s.original_name))
  );
  
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Handle checkbox toggle
  const handleToggle = (originalName: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(originalName)) {
        newSet.delete(originalName);
      } else {
        newSet.add(originalName);
      }
      return newSet;
    });
  };
  
  // Handle select all
  const handleSelectAll = () => {
    setSelectedSuggestions(new Set(suggestions.map(s => s.original_name)));
  };
  
  // Handle deselect all
  const handleDeselectAll = () => {
    setSelectedSuggestions(new Set());
  };
  
  // Handle apply
  const handleApply = () => {
    const selected = suggestions.filter(s => selectedSuggestions.has(s.original_name));
    onApply(selected);
  };
  
  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return '#22c55e'; // green
    if (confidence >= 0.7) return '#3b82f6'; // blue
    if (confidence >= 0.5) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };
  
  // Get confidence label
  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Moderate';
    return 'Low';
  };
  
  return (
    <div
      ref={dialogRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '700px',
        maxHeight: '600px',
        backgroundColor: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        color: '#e0e0e0'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #444',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          cursor: 'move',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onMouseDown={onDragStart}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          AI Net Name Suggestions
        </h3>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 4px'
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      
      {/* Info */}
      <div style={{ padding: '12px 16px', backgroundColor: '#252525', borderBottom: '1px solid #444' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>
          AI has analyzed your netlist and suggested {suggestions.length} descriptive name{suggestions.length !== 1 ? 's' : ''} for generic signal nets.
          Review and select which suggestions to apply.
        </p>
      </div>
      
      {/* Toolbar */}
      <div style={{ padding: '8px 16px', backgroundColor: '#252525', borderBottom: '1px solid #444', display: 'flex', gap: '8px' }}>
        <button
          onClick={handleSelectAll}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            backgroundColor: '#3a3a3a',
            color: '#e0e0e0',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Select All
        </button>
        <button
          onClick={handleDeselectAll}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            backgroundColor: '#3a3a3a',
            color: '#e0e0e0',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Deselect All
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#aaa', alignSelf: 'center' }}>
          {selectedSuggestions.size} of {suggestions.length} selected
        </div>
      </div>
      
      {/* Suggestions List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
            No suggestions available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.original_name}
                style={{
                  padding: '12px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
              >
                {/* Checkbox */}
                <label className="radio-label" style={{ marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(suggestion.original_name)}
                    onChange={() => handleToggle(suggestion.original_name)}
                  />
                  <span className="custom-checkbox"></span>
                </label>
                
                {/* Content */}
                <div style={{ flex: 1 }}>
                  {/* Net names */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '13px', 
                      color: '#888',
                      textDecoration: 'line-through'
                    }}>
                      {suggestion.original_name}
                    </span>
                    <span style={{ color: '#666' }}>→</span>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '14px', 
                      fontWeight: 600,
                      color: '#4fc3f7'
                    }}>
                      {suggestion.suggested_name}
                    </span>
                  </div>
                  
                  {/* Confidence */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>Confidence:</span>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: getConfidenceColor(suggestion.confidence) + '22',
                      color: getConfidenceColor(suggestion.confidence),
                      border: `1px solid ${getConfidenceColor(suggestion.confidence)}44`
                    }}>
                      {getConfidenceLabel(suggestion.confidence)} ({(suggestion.confidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                  
                  {/* Reasoning */}
                  <div style={{ fontSize: '12px', color: '#bbb', lineHeight: '1.4' }}>
                    {suggestion.reasoning}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div style={{ 
        padding: '12px 16px', 
        backgroundColor: '#2d2d2d', 
        borderTop: '1px solid #444',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px'
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            backgroundColor: '#3a3a3a',
            color: '#e0e0e0',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={selectedSuggestions.size === 0}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            backgroundColor: selectedSuggestions.size === 0 ? '#333' : '#0066cc',
            color: selectedSuggestions.size === 0 ? '#666' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedSuggestions.size === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 600
          }}
        >
          Apply Selected ({selectedSuggestions.size})
        </button>
      </div>
    </div>
  );
};
