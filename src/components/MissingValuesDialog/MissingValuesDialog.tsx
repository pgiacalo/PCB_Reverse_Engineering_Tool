/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 */

import React from 'react';
import type { PCBComponent } from '../../types';

export interface MissingValueInfo {
  designator: string;
  componentType: string;
  missingFields: string[];
  componentId: string;
  layer: 'top' | 'bottom';
}

interface MissingValuesDialogProps {
  missingValues: MissingValueInfo[];
  onClose: () => void;
  onProceed: () => void;
  onFixComponent: (componentId: string, layer: 'top' | 'bottom', focusField?: string) => void;
  position?: { x: number; y: number };
}

export const MissingValuesDialog: React.FC<MissingValuesDialogProps> = ({
  missingValues,
  onClose,
  onProceed,
  onFixComponent,
  position = { x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 200 }
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [dialogPosition, setDialogPosition] = React.useState(position);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - dialogPosition.x,
      y: e.clientY - dialogPosition.y
    });
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      setDialogPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatFieldName = (fieldName: string): string => {
    // Convert camelCase to Title Case with spaces
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
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
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          left: dialogPosition.x,
          top: dialogPosition.y,
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#f5f5f5',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#d32f2f' }}>
            ⚠️ Missing Component Values
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>
            {missingValues.length} component{missingValues.length !== 1 ? 's' : ''} missing required values
          </p>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#333', lineHeight: '1.5' }}>
            The following components are missing required values. These components will not have complete
            information in the exported netlist.
          </p>

          {/* Component List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {missingValues.map((item, index) => (
              <div
                key={`${item.componentId}-${index}`}
                style={{
                  padding: '12px',
                  backgroundColor: '#fff3e0',
                  border: '1px solid #ffb74d',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#e65100' }}>
                      {item.designator}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                      ({item.componentType})
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        backgroundColor: item.layer === 'top' ? '#e3f2fd' : '#f3e5f5',
                        color: item.layer === 'top' ? '#1976d2' : '#7b1fa2',
                        borderRadius: '3px',
                        fontWeight: 600
                      }}
                    >
                      {item.layer.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Missing: {item.missingFields.map(formatFieldName).join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Close this dialog first
                    onClose();
                    // Then open the component editor with focus on the first missing field
                    onFixComponent(item.componentId, item.layer, item.missingFields[0]);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1565c0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1976d2';
                  }}
                >
                  Fix →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#f5f5f5',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#fff',
              color: '#666',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
              e.currentTarget.style.borderColor = '#999';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
              e.currentTarget.style.borderColor = '#ccc';
            }}
          >
            Cancel Export
          </button>
          <button
            onClick={onProceed}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ff9800',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f57c00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff9800';
            }}
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  );
};
