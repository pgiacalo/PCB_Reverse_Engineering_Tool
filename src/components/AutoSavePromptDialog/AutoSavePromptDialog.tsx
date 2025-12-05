import React from 'react';

export interface AutoSavePromptDialogProps {
  visible: boolean;
  interval: number | null;
  onIntervalChange: (interval: number | null) => void;
  onEnable: () => void;
  onSkip: () => void;
}

export const AutoSavePromptDialog: React.FC<AutoSavePromptDialogProps> = ({
  visible,
  interval,
  onIntervalChange,
  onEnable,
  onSkip,
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
        if (e.target === e.currentTarget) {
          onSkip();
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
          Enable Auto Save?
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#e0e0e0', lineHeight: '1.5' }}>
          We recommend enabling Auto Save to automatically save your project at regular intervals. 
          This helps protect your work from accidental loss.
        </p>
        
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
            marginBottom: '24px',
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
        </select>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onSkip}
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
            Skip
          </button>
          <button
            onClick={onEnable}
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
            Enable Auto Save
          </button>
        </div>
      </div>
    </div>
  );
};

