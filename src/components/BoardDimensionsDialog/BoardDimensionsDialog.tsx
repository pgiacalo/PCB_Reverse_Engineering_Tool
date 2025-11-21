/**
 * Copyright 2025 Philip L. Giacalone
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * BoardDimensionsDialog component
 * Dialog for entering board dimensions in inches or millimeters
 */

import React, { useState, useEffect } from 'react';

export type DimensionUnit = 'inches' | 'mm';

export interface BoardDimensions {
  width: number;
  height: number;
  unit: DimensionUnit;
}

export interface BoardDimensionsDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Current board dimensions */
  dimensions: BoardDimensions | null;
  /** Callback to save dimensions */
  onSave: (dimensions: BoardDimensions) => void;
  /** Callback to close the dialog */
  onClose: () => void;
}

export const BoardDimensionsDialog: React.FC<BoardDimensionsDialogProps> = ({
  visible,
  dimensions,
  onSave,
  onClose,
}) => {
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [unit, setUnit] = useState<DimensionUnit>('inches');

  useEffect(() => {
    if (visible && dimensions) {
      setWidth(dimensions.width.toString());
      setHeight(dimensions.height.toString());
      setUnit(dimensions.unit);
    } else if (visible) {
      // Initialize with empty values if no dimensions exist
      setWidth('');
      setHeight('');
      setUnit('inches');
    }
  }, [visible, dimensions]);

  const handleSave = () => {
    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);

    if (isNaN(widthNum) || widthNum <= 0) {
      alert('Please enter a valid width greater than 0');
      return;
    }

    if (isNaN(heightNum) || heightNum <= 0) {
      alert('Please enter a valid height greater than 0');
      return;
    }

    onSave({
      width: widthNum,
      height: heightNum,
      unit,
    });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!visible) return null;

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
        zIndex: 10004,
      }}
      onClick={(e) => {
        // Close dialog if clicking on backdrop
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#2b2b31',
          borderRadius: 8,
          padding: '24px',
          minWidth: '320px',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #444',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '18px', fontWeight: 600 }}>
          Board Dimensions
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '14px' }}>
            Width
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                fontSize: '14px',
              }}
              placeholder="0.000"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as DimensionUnit)}
              style={{
                padding: '8px 12px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="inches">inches</option>
              <option value="mm">mm</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '14px' }}>
            Height
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                fontSize: '14px',
              }}
              placeholder="0.000"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as DimensionUnit)}
              style={{
                padding: '8px 12px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="inches">inches</option>
              <option value="mm">mm</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '12px', padding: '10px', background: '#1f1f24', borderRadius: 4, fontSize: '12px', color: '#bbb' }}>
          This information will be used to convert pixel coordinates to real-world measurements.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              background: '#444',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

