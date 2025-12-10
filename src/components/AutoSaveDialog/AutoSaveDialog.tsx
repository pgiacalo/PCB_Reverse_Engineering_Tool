/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
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

import React from 'react';

export interface AutoSaveDialogProps {
  visible: boolean;
  interval: number | null;
  onIntervalChange: (interval: number | null) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const AutoSaveDialog: React.FC<AutoSaveDialogProps> = ({
  visible,
  interval,
  onIntervalChange,
  onApply,
  onCancel,
}) => {
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
        zIndex: 10003,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#2b2b31',
          borderRadius: 8,
          padding: '24px',
          minWidth: '300px',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1f1f24',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
          Auto Save
        </h2>
        
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
          Select time interval:
        </label>
        <select
          value={interval === null ? 'disable' : (interval || 5).toString()}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'disable') {
              onIntervalChange(null);
            } else {
              const numValue = parseFloat(value);
              if (!isNaN(numValue) && numValue > 0) {
                onIntervalChange(numValue);
              }
            }
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            marginBottom: '20px',
            background: '#1f1f24',
            border: '1px solid #444',
            borderRadius: 6,
            color: '#f2f2f2',
            fontSize: '14px',
          }}
          autoFocus
        >
          <option value="1" style={{ background: '#1f1f24', color: '#f2f2f2' }}>1 minute</option>
          <option value="5" style={{ background: '#1f1f24', color: '#f2f2f2' }}>5 minutes</option>
          <option value="10" style={{ background: '#1f1f24', color: '#f2f2f2' }}>10 minutes</option>
          <option value="20" style={{ background: '#1f1f24', color: '#f2f2f2' }}>20 minutes</option>
          <option value="30" style={{ background: '#1f1f24', color: '#f2f2f2' }}>30 minutes</option>
          <option value="disable" style={{ background: '#1f1f24', color: '#f2f2f2' }}>Disable</option>
        </select>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: '#444',
              color: '#f2f2f2',
              border: '1px solid #555',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onApply}
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
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

