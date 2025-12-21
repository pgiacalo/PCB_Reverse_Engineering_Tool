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

// Microchip icon for orientation visual aids
// Based on the provided icon: dark grey microchip with pins on left/right, inner white rectangle with orientation dot
const MicrochipIconSVG = ({ rotate = 0 }: { rotate?: number }) => {
  const centerX = 20;
  const centerY = 20;
  const transform = rotate !== 0 ? `rotate(${rotate} ${centerX} ${centerY})` : '';
  
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginLeft: '8px', flexShrink: 0 }}>
      <g transform={transform}>
        {/* Main body - dark grey rectangle with rounded corners */}
        <rect x="8" y="10" width="24" height="20" rx="2" ry="2" fill="#555" />
        
        {/* Left side pins (3 pins) */}
        <rect x="2" y="12" width="6" height="3" rx="1" ry="1" fill="#555" />
        <rect x="2" y="18" width="6" height="3" rx="1" ry="1" fill="#555" />
        <rect x="2" y="24" width="6" height="3" rx="1" ry="1" fill="#555" />
        
        {/* Right side pins (3 pins) */}
        <rect x="32" y="12" width="6" height="3" rx="1" ry="1" fill="#555" />
        <rect x="32" y="18" width="6" height="3" rx="1" ry="1" fill="#555" />
        <rect x="32" y="24" width="6" height="3" rx="1" ry="1" fill="#555" />
        
        {/* Inner white rectangle with rounded corners */}
        <rect x="12" y="14" width="16" height="12" rx="1.5" ry="1.5" fill="#fff" />
        
        {/* Orientation dot - small dark grey circle in top-left of inner rectangle */}
        <circle cx="14" cy="16" r="1.5" fill="#555" />
      </g>
    </svg>
  );
};

const VerticalOrientationSVG = () => <MicrochipIconSVG rotate={0} />;
const HorizontalOrientationSVG = () => <MicrochipIconSVG rotate={90} />;

export const ICPlacementDialog: React.FC<ICPlacementDialogProps> = ({
  visible,
  isPad,
  onConfirm,
  onClose,
}) => {
  const [type, setType] = useState<ComponentType>('linear');
  const [twoSidedOrientation, setTwoSidedOrientation] = useState<TwoSidedOrientation>('vertical-edges');
  const [numPinsText, setNumPinsText] = useState<string>('8');
  const [error, setError] = useState<string>('');

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      setType('linear');
      setTwoSidedOrientation('vertical-edges');
      setNumPinsText('8');
      setError('');
    }
  }, [visible]);

  const validateNumPins = (value: string, arrangementType: ComponentType): { valid: boolean; error: string; numPins?: number } => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { valid: false, error: 'Number of pins is required.' };
    }

    const num = parseInt(trimmed, 10);
    if (isNaN(num)) {
      return { valid: false, error: 'Please enter a valid number.' };
    }

    if (num < 1) {
      return { valid: false, error: 'Number of pins must be >= 1.' };
    }

    if (arrangementType === 'linear') {
      // Linear allows only positive integers
      if (num !== Math.floor(num) || num <= 0) {
        return { valid: false, error: 'Linear arrangement requires a positive integer.' };
      }
      return { valid: true, error: '', numPins: num };
    } else if (arrangementType === 'twoSided') {
      // 2-sided allows only positive even integers
      if (num !== Math.floor(num) || num <= 0) {
        return { valid: false, error: '2-sided arrangement requires a positive integer.' };
      }
      if (num % 2 !== 0) {
        return { valid: false, error: '2-sided components must have an even number of pins.' };
      }
      return { valid: true, error: '', numPins: num };
    } else if (arrangementType === 'fourSided') {
      // 4-sided allows only positive integers evenly divisible by 4
      if (num !== Math.floor(num) || num <= 0) {
        return { valid: false, error: '4-sided arrangement requires a positive integer.' };
      }
      if (num % 4 !== 0) {
        return { valid: false, error: '4-sided components must have a number of pins divisible by 4.' };
      }
      return { valid: true, error: '', numPins: num };
    }

    return { valid: true, error: '', numPins: num };
  };

  const handleNumPinsChange = (value: string) => {
    setNumPinsText(value);
    const validation = validateNumPins(value, type);
    if (validation.error) {
      setError(validation.error);
    } else {
      setError('');
    }
  };

  const handleConfirm = () => {
    const validation = validateNumPins(numPinsText, type);
    
    if (!validation.valid || validation.numPins === undefined) {
      setError(validation.error || 'Invalid number of pins.');
      return;
    }

    setError('');
    onConfirm({
      numPins: validation.numPins,
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
          minWidth: '320px',
          maxWidth: '380px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#222', fontSize: '18px' }}>
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
                onChange={(e) => {
                  const newType = e.target.value as ComponentType;
                  setType(newType);
                  // Re-validate when arrangement type changes
                  const validation = validateNumPins(numPinsText, newType);
                  if (validation.error) {
                    setError(validation.error);
                  } else {
                    setError('');
                  }
                }}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: '#222' }}>Linear (1 side)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="twoSided"
                checked={type === 'twoSided'}
                onChange={(e) => {
                  const newType = e.target.value as ComponentType;
                  setType(newType);
                  // Re-validate when arrangement type changes
                  const validation = validateNumPins(numPinsText, newType);
                  if (validation.error) {
                    setError(validation.error);
                  } else {
                    setError('');
                  }
                }}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: '#222' }}>2-Sided</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="fourSided"
                checked={type === 'fourSided'}
                onChange={(e) => {
                  const newType = e.target.value as ComponentType;
                  setType(newType);
                  // Re-validate when arrangement type changes
                  const validation = validateNumPins(numPinsText, newType);
                  if (validation.error) {
                    setError(validation.error);
                  } else {
                    setError('');
                  }
                }}
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
                <VerticalOrientationSVG />
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
                <HorizontalOrientationSVG />
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
            value={numPinsText}
            onChange={(e) => handleNumPinsChange(e.target.value)}
            onBlur={() => {
              const validation = validateNumPins(numPinsText, type);
              if (!validation.valid) {
                setError(validation.error);
              }
            }}
            style={{
              width: '80px',
              padding: '6px',
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

