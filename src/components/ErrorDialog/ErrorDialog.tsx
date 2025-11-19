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

