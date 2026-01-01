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

