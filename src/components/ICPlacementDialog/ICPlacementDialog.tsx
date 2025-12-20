import React, { useState, useEffect } from 'react';
import type { ComponentType, TwoSidedOrientation } from '../../types/icPlacement';

export interface ICPlacementDialogProps {
  visible: boolean;
  isPad: boolean;
  onConfirm: (options: {
    numPins: number;
    type: ComponentType;
    twoSidedOrientation?: TwoSidedOrientation;
  }) => void;
  onClose: () => void;
}

export const ICPlacementDialog: React.FC<ICPlacementDialogProps> = ({
  visible,
  isPad,
  onConfirm,
  onClose,
}) => {
  const [type, setType] = useState<ComponentType>('linear');
  const [twoSidedOrientation, setTwoSidedOrientation] = useState<TwoSidedOrientation>('vertical-edges');
  const [numPins, setNumPins] = useState<number>(8);
  const [error, setError] = useState<string>('');

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      setType('linear');
      setTwoSidedOrientation('vertical-edges');
      setNumPins(8);
      setError('');
    }
  }, [visible]);

  const handleConfirm = () => {
    // Validate
    let validationError = '';
    
    if (numPins < 1) {
      validationError = 'Number of pins must be >= 1.';
    } else if (type === 'twoSided' && numPins % 2 !== 0) {
      validationError = '2-sided components must have an even number of pins.';
    } else if (type === 'fourSided' && numPins % 4 !== 0) {
      validationError = '4-sided components must have N divisible by 4.';
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    onConfirm({
      numPins,
      type,
      ...(type === 'twoSided' ? { twoSidedOrientation } : {}),
    });
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
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#222' }}>
          {isPad ? 'Pad Pattern' : 'Via Pattern'} Placement
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#222', fontWeight: 500 }}>
            Arrangement:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="linear"
                checked={type === 'linear'}
                onChange={(e) => setType(e.target.value as ComponentType)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: '#222' }}>Linear (1 side)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="twoSided"
                checked={type === 'twoSided'}
                onChange={(e) => setType(e.target.value as ComponentType)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: '#222' }}>2-Sided</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="fourSided"
                checked={type === 'fourSided'}
                onChange={(e) => setType(e.target.value as ComponentType)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: '#222' }}>4-Sided</span>
            </label>
          </div>
        </div>

        {type === 'twoSided' && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#222', fontWeight: 500 }}>
              Orientation:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="vertical-edges"
                  checked={twoSidedOrientation === 'vertical-edges'}
                  onChange={(e) => setTwoSidedOrientation(e.target.value as TwoSidedOrientation)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: '#222' }}>Vertical {isPad ? 'Pads' : 'Vias'} (left & right)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="horizontal-edges"
                  checked={twoSidedOrientation === 'horizontal-edges'}
                  onChange={(e) => setTwoSidedOrientation(e.target.value as TwoSidedOrientation)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: '#222' }}>Horizontal {isPad ? 'Pads' : 'Vias'} (top & bottom)</span>
              </label>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#222', fontWeight: 500 }}>
            Number of Pins:
          </label>
          <input
            type="number"
            min="1"
            value={numPins}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                setNumPins(val);
                setError('');
              }
            }}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#000',
              background: '#fff',
            }}
          />
          {error && (
            <div style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#f5f5f5',
              color: '#222',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              background: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

