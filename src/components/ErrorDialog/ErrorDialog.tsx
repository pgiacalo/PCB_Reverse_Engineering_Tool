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
 * ErrorDialog component
 * Displays error messages in a modal dialog
 */

import React from 'react';

export interface ErrorDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Error dialog title */
  title: string;
  /** Error message */
  message: string;
  /** Callback to close the dialog */
  onClose: () => void;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({
  visible,
  title,
  message,
  onClose,
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
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '2px solid #ff4444',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px', color: '#ff4444' }}>⚠️</div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
            {title}
          </h3>
        </div>
        <div style={{ marginBottom: '20px', color: '#ddd', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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

