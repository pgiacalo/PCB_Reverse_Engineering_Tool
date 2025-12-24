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
 * IMPLIED, INCLUDING WITHOUT LIMITATION THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * InfoDialog component
 * Displays informational/success messages in a modal dialog
 */

import React from 'react';

export interface InfoDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Dialog title */
  title: string;
  /** Message to display */
  message: string;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Dialog type: 'success' or 'info' */
  type?: 'success' | 'info';
  /** Optional callback to show response (for error dialogs) */
  onShowResponse?: () => void;
}

export const InfoDialog: React.FC<InfoDialogProps> = ({
  visible,
  title,
  message,
  onClose,
  type = 'info',
  onShowResponse,
}) => {
  if (!visible) return null;

  const iconColor = type === 'success' ? '#4CAF50' : '#2196F3';
  const borderColor = type === 'success' ? '#4CAF50' : '#2196F3';
  const icon = type === 'success' ? '✓' : 'ℹ️';

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
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#2b2b31',
          borderRadius: 8,
          padding: '24px',
          minWidth: '300px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          width: '600px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: `2px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ fontSize: '24px', color: iconColor }}>{icon}</div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
            {title}
          </h3>
        </div>
        <div style={{ 
          marginBottom: '20px', 
          color: '#ddd', 
          fontSize: '14px', 
          lineHeight: '1.5', 
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowY: 'auto',
          maxHeight: '60vh',
          paddingRight: '8px',
          flex: 1,
        }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {onShowResponse && (
            <button
              onClick={() => {
                onShowResponse();
                onClose();
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
              Show Response
            </button>
          )}
          <button
            onClick={onClose}
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
  );
};

