import React from 'react';

export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onYes: () => void;
  onNo: () => void;
  onCancel: () => void;
  yesButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  onYes,
  onNo,
  onCancel,
  yesButtonRef,
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
        zIndex: 10001,
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
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1f1f24',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#e0e0e0', lineHeight: '1.5' }}>
          {message}
        </p>
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
            onClick={onNo}
            style={{
              padding: '8px 16px',
              background: '#555',
              color: '#f2f2f2',
              border: '1px solid #666',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            No
          </button>
          <button
            ref={yesButtonRef}
            onClick={onYes}
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
            autoFocus
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

