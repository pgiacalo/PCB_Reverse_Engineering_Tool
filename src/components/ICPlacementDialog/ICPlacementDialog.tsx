import React, { useState, useEffect, useCallback } from 'react';
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

// Linear (1-side) icon - component with 6 pins on bottom only
const LinearIconSVG = () => (
  <svg width="45" height="30" viewBox="0 0 45 30" style={{ marginLeft: '8px', flexShrink: 0 }}>
    {/* Main body - black rectangle with rounded corners */}
    <rect x="8" y="4" width="29" height="14" rx="2" ry="2" fill="#000" />
    {/* Bottom pins - 6 pins extending downward, evenly spaced */}
    <rect x="10" y="18" width="2.5" height="6" rx="0.5" fill="#000" />
    <rect x="14.5" y="18" width="2.5" height="6" rx="0.5" fill="#000" />
    <rect x="19" y="18" width="2.5" height="6" rx="0.5" fill="#000" />
    <rect x="23.5" y="18" width="2.5" height="6" rx="0.5" fill="#000" />
    <rect x="28" y="18" width="2.5" height="6" rx="0.5" fill="#000" />
    <rect x="32.5" y="18" width="2.5" height="6" rx="0.5" fill="#000" />
  </svg>
);

// 2-Sided icon - component with 3 pins on left and 3 pins on right, inner white rectangle with orientation dot
const TwoSidedIconSVG = () => (
  <svg width="40" height="30" viewBox="0 0 40 30" style={{ marginLeft: '8px', flexShrink: 0 }}>
    {/* Left side pins - 3 pins extending horizontally from middle */}
    <rect x="2" y="11" width="5" height="2.5" rx="0.5" fill="#000" />
    <rect x="2" y="14.5" width="5" height="2.5" rx="0.5" fill="#000" />
    <rect x="2" y="18" width="5" height="2.5" rx="0.5" fill="#000" />
    {/* Main body - black rectangle with rounded corners */}
    <rect x="7" y="6" width="26" height="18" rx="2" ry="2" fill="#000" />
    {/* Inner white rectangle with rounded corners */}
    <rect x="13" y="10" width="14" height="10" rx="1.5" ry="1.5" fill="#fff" />
    {/* Orientation dot - small black circle in top-left of inner rectangle */}
    <circle cx="14.5" cy="11.5" r="1" fill="#000" />
    {/* Right side pins - 3 pins extending horizontally from middle */}
    <rect x="33" y="11" width="5" height="2.5" rx="0.5" fill="#000" />
    <rect x="33" y="14.5" width="5" height="2.5" rx="0.5" fill="#000" />
    <rect x="33" y="18" width="5" height="2.5" rx="0.5" fill="#000" />
  </svg>
);

// 4-Sided icon - component with 3 pins on each of the 4 sides
const FourSidedIconSVG = () => (
  <svg width="35" height="35" viewBox="0 0 35 35" style={{ marginLeft: '8px', flexShrink: 0 }}>
    {/* Top pins - 3 pins */}
    <rect x="12" y="2" width="2.5" height="4" rx="0.5" fill="#000" />
    <rect x="16.25" y="2" width="2.5" height="4" rx="0.5" fill="#000" />
    <rect x="20.5" y="2" width="2.5" height="4" rx="0.5" fill="#000" />
    {/* Left pins - 3 pins */}
    <rect x="2" y="12" width="4" height="2.5" rx="0.5" fill="#000" />
    <rect x="2" y="16.25" width="4" height="2.5" rx="0.5" fill="#000" />
    <rect x="2" y="20.5" width="4" height="2.5" rx="0.5" fill="#000" />
    {/* Main body - black square */}
    <rect x="6" y="6" width="23" height="23" fill="#000" />
    {/* Right pins - 3 pins */}
    <rect x="29" y="12" width="4" height="2.5" rx="0.5" fill="#000" />
    <rect x="29" y="16.25" width="4" height="2.5" rx="0.5" fill="#000" />
    <rect x="29" y="20.5" width="4" height="2.5" rx="0.5" fill="#000" />
    {/* Bottom pins - 3 pins */}
    <rect x="12" y="29" width="2.5" height="4" rx="0.5" fill="#000" />
    <rect x="16.25" y="29" width="2.5" height="4" rx="0.5" fill="#000" />
    <rect x="20.5" y="29" width="2.5" height="4" rx="0.5" fill="#000" />
  </svg>
);

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
    // Remove any non-numeric characters except empty string
    let filteredValue = value === '' ? '' : value.replace(/[^\d]/g, '');
    
    setNumPinsText(filteredValue);
    const validation = validateNumPins(filteredValue, type);
    if (validation.error) {
      setError(validation.error);
    } else {
      setError('');
    }
  };

  const handleConfirm = useCallback(() => {
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
  }, [numPinsText, type, twoSidedOrientation, onConfirm]);

  // Handle Enter key to trigger OK button
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, handleConfirm]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        .number-input-large-spinners::-webkit-inner-spin-button,
        .number-input-large-spinners::-webkit-outer-spin-button {
          opacity: 1;
          height: 20px;
          width: 20px;
          cursor: pointer;
        }
        .number-input-large-spinners::-webkit-inner-spin-button {
          margin-right: 4px;
        }
      `}</style>
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
              <LinearIconSVG />
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
              <TwoSidedIconSVG />
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
              <FourSidedIconSVG />
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
            min={type === 'linear' ? 1 : type === 'twoSided' ? 2 : 4}
            step={type === 'linear' ? 1 : type === 'twoSided' ? 2 : 4}
            value={numPinsText}
            onChange={(e) => handleNumPinsChange(e.target.value)}
            onBlur={() => {
              const validation = validateNumPins(numPinsText, type);
              if (!validation.valid) {
                setError(validation.error);
              } else {
                setError('');
              }
            }}
            style={{
              width: '80px',
              padding: '6px 24px 6px 6px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#000',
              background: '#fff',
            }}
            className="number-input-large-spinners"
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
            onClick={handleConfirm}
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
    </>
  );
};

