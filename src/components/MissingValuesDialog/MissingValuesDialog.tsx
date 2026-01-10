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
  position = { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 }
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [dialogPosition, setDialogPosition] = React.useState(position);
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeStart, setResizeStart] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dialogSize, setDialogSize] = React.useState({ width: 400, height: 300 });

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

  // Handle resize
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: dialogSize.width,
      height: dialogSize.height
    });
  };

  const handleResizeMouseMove = React.useCallback((e: MouseEvent) => {
    if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newWidth = Math.max(300, resizeStart.width + deltaX);
      const newHeight = Math.max(200, resizeStart.height + deltaY);
      setDialogSize({ width: newWidth, height: newHeight });
    }
  }, [isResizing, resizeStart]);

  const handleResizeMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

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
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          width: `${dialogSize.width}px`,
          height: `${dialogSize.height}px`,
          display: 'flex',
          flexDirection: 'column',
          cursor: isDragging ? 'grabbing' : 'default',
          border: '1px solid #ccc'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #ccc',
            backgroundColor: '#e8e8e8',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            cursor: 'move'
          }}
          onMouseDown={handleMouseDown}
        >
          <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#d32f2f' }}>
            ⚠️ Missing Component Values ({missingValues.length})
          </h2>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '12px',
            overflowY: 'auto',
            flex: 1,
            fontSize: '11px'
          }}
        >
          {/* Component List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {missingValues.map((item, index) => (
              <div
                key={`${item.componentId}-${index}`}
                style={{
                  padding: '8px',
                  backgroundColor: '#fff3e0',
                  border: '1px solid #ffb74d',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px', color: '#e65100' }}>
                      {item.designator}
                    </span>
                    <span style={{ fontSize: '10px', color: '#666' }}>
                      {item.componentType}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        backgroundColor: item.layer === 'top' ? '#e3f2fd' : '#f3e5f5',
                        color: item.layer === 'top' ? '#1976d2' : '#7b1fa2',
                        borderRadius: '2px',
                        fontWeight: 600
                      }}
                    >
                      {item.layer.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    Missing: {item.missingFields.map(formatFieldName).join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Don't close dialog - keep it visible
                    // Open the component editor with focus on the first missing field
                    onFixComponent(item.componentId, item.layer, item.missingFields[0]);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#0b5fff',
                    color: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '2px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Fix
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #ccc',
            backgroundColor: '#f5f5f5',
            borderBottomLeftRadius: '4px',
            borderBottomRightRadius: '4px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              backgroundColor: '#fff',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '2px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            style={{
              padding: '4px 8px',
              backgroundColor: '#0b5fff',
              color: '#fff',
              border: '1px solid #ddd',
              borderRadius: '2px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Proceed
          </button>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '16px',
            height: '16px',
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 0%, transparent 50%, #999 50%, #999 100%)',
            borderBottomRightRadius: '4px'
          }}
        />
      </div>
    </div>
  );
};
