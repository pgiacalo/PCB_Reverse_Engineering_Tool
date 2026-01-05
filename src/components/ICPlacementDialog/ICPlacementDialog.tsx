import React, { useState, useEffect, useCallback } from 'react';
import type { ComponentType, TwoSidedOrientation, ZigZagOrientation } from '../../types/icPlacement';

export interface ICPlacementDialogProps {
  visible: boolean;
  isPad: boolean;
  onConfirm: (options: {
    numPins: number;
    type: ComponentType;
    twoSidedOrientation?: TwoSidedOrientation;
    zigzagOrientation?: ZigZagOrientation;
  }) => void;
  onClose: () => void;
}

// Linear (1-side) icon - component with 6 pins on bottom only
const LinearIconSVG = () => (
  <svg width="90" height="60" viewBox="0 0 45 30" style={{ marginLeft: '12px', flexShrink: 0 }}>
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

// 2-Sided IC icon - component with 3 pins on left and 3 pins on right, inner white rectangle with orientation dot
const TwoSidedIconSVG = ({ rotate = 0 }: { rotate?: number }) => (
  <svg width="80" height="60" viewBox="0 0 40 30" style={{ marginLeft: '12px', flexShrink: 0 }}>
    <g transform={rotate ? `rotate(${rotate} 20 15)` : ''}>
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
    </g>
  </svg>
);

// 4-Sided IC icon - component with 3 pins on each of the 4 sides
const FourSidedIconSVG = () => (
  <svg width="70" height="70" viewBox="0 0 35 35" style={{ marginLeft: '12px', flexShrink: 0 }}>
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

// Zig-Zag icon - recreation of provided image with 6 pins and thin red lines
const ZigZagIconSVG = ({ rotate = 0 }: { rotate?: number }) => (
  <svg width="80" height="100" viewBox="0 0 40 50" style={{ marginLeft: '12px', flexShrink: 0 }}>
    <g transform={rotate ? `rotate(${rotate} 20 25)` : ''}>
      {/* Path lines - thin red lines matching provided image */}
      <line x1="12" y1="10" x2="28" y2="10" stroke="#f44336" strokeWidth="1.2" />
      <line x1="28" y1="10" x2="12" y2="25" stroke="#f44336" strokeWidth="1.2" />
      <line x1="12" y1="25" x2="28" y2="25" stroke="#f44336" strokeWidth="1.2" />
      <line x1="28" y1="25" x2="12" y2="40" stroke="#f44336" strokeWidth="1.2" />
      <line x1="12" y1="40" x2="28" y2="40" stroke="#f44336" strokeWidth="1.2" />
      
      {/* Pins/Dots - large dark grey circles */}
      <circle cx="12" cy="10" r="3.5" fill="#333" />
      <circle cx="28" cy="10" r="3.5" fill="#333" />
      <circle cx="12" cy="25" r="3.5" fill="#333" />
      <circle cx="28" cy="25" r="3.5" fill="#333" />
      <circle cx="12" cy="40" r="3.5" fill="#333" />
      <circle cx="28" cy="40" r="3.5" fill="#333" />
      
      {/* Number Labels - simplified font and placement */}
      <text x="4" y="12.5" fontSize="10" fontFamily="Arial" fill="#333">1</text>
      <text x="33" y="12.5" fontSize="10" fontFamily="Arial" fill="#333">2</text>
      <text x="4" y="27.5" fontSize="10" fontFamily="Arial" fill="#333">3</text>
      <text x="33" y="27.5" fontSize="10" fontFamily="Arial" fill="#333">4</text>
      <text x="4" y="42.5" fontSize="10" fontFamily="Arial" fill="#333">5</text>
      <text x="33" y="42.5" fontSize="10" fontFamily="Arial" fill="#333">6</text>
    </g>
  </svg>
);

export const ICPlacementDialog: React.FC<ICPlacementDialogProps> = ({
  visible,
  isPad,
  onConfirm,
  onClose,
}) => {
  const [type, setType] = useState<ComponentType>('twoSided');
  const [twoSidedOrientation, setTwoSidedOrientation] = useState<TwoSidedOrientation>('vertical-edges');
  const [zigzagOrientation, setZigZagOrientation] = useState<ZigZagOrientation>('vertical');
  const [numPinsText, setNumPinsText] = useState<string>('8');
  const [error, setError] = useState<string>('');

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      setType('twoSided');
      setTwoSidedOrientation('vertical-edges');
      setZigZagOrientation('vertical');
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
    } else if (arrangementType === 'zigzag') {
      // Zig-Zag allows only positive even integers
      if (num !== Math.floor(num) || num <= 0) {
        return { valid: false, error: 'Zig-Zag arrangement requires a positive integer.' };
      }
      if (num % 2 !== 0) {
        return { valid: false, error: 'Zig-Zag arrangement requires an even number of pins.' };
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
      ...(type === 'zigzag' ? { zigzagOrientation } : {}),
    });
  }, [numPinsText, type, twoSidedOrientation, zigzagOrientation, onConfirm]);

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

        .custom-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          transition: all 0.2s ease;
          position: relative;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
        }

        .custom-radio.selected {
          border-color: #4CAF50;
          background: #fff;
        }

        .custom-radio.selected::after {
          content: '';
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #4CAF50;
        }

        .radio-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .radio-label:hover {
          background: #f5f5f5;
        }

        .radio-label:hover .custom-radio {
          border-color: #999;
        }

        .radio-label:hover .custom-radio.selected {
          border-color: #45a049;
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
          padding: '24px',
          borderRadius: '12px',
          minWidth: '500px',
          maxWidth: '650px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#222', fontSize: '18px' }}>
          {isPad ? 'Pad Pattern' : 'Via Pattern'} Placement
        </h2>

        <div style={{ marginBottom: '12px' }}>
          {/* Section 1: Integrated Circuits */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#444', marginBottom: '8px', borderBottom: '2px solid #ddd', paddingBottom: '4px' }}>
              Integrated Circuits
            </div>
            
            {/* 4-Sided IC */}
            <label className="radio-label" style={{ marginBottom: '8px' }}>
              <input
                type="radio"
                name="arrangement"
                value="fourSided"
                checked={type === 'fourSided'}
                onChange={() => {
                  setType('fourSided');
                  const validation = validateNumPins(numPinsText, 'fourSided');
                  setError(validation.error || '');
                }}
                style={{ display: 'none' }}
              />
              <div className={`custom-radio ${type === 'fourSided' ? 'selected' : ''}`} style={{ marginRight: '10px' }}></div>
              <span style={{ color: '#222', fontSize: '15px' }}>4-Sided IC</span>
              <FourSidedIconSVG />
            </label>

            {/* 2-Sided IC with Vertical/Horizontal columns */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '10px 30px', alignItems: 'center' }}>
                <div style={{ gridColumn: '2 / 3', color: '#555', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>Vertical {isPad ? 'Pads' : 'Vias'}</div>
                <div style={{ gridColumn: '3 / 4', color: '#555', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>Horizontal {isPad ? 'Pads' : 'Vias'}</div>
                
                <div style={{ color: '#222', fontSize: '15px', fontWeight: 500 }}>2-Sided IC:</div>
                <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', cursor: 'pointer', gap: '12px', justifyContent: 'center' }} className="radio-label">
                  <input
                    type="radio"
                    name="arrangement"
                    checked={type === 'twoSided' && twoSidedOrientation === 'vertical-edges'}
                    onChange={() => {
                      setType('twoSided');
                      setTwoSidedOrientation('vertical-edges');
                      const validation = validateNumPins(numPinsText, 'twoSided');
                      setError(validation.error || '');
                    }}
                    style={{ display: 'none' }}
                  />
                  <div className={`custom-radio ${type === 'twoSided' && twoSidedOrientation === 'vertical-edges' ? 'selected' : ''}`}></div>
                  <TwoSidedIconSVG />
                </label>
                <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', cursor: 'pointer', gap: '12px', justifyContent: 'center' }} className="radio-label">
                  <input
                    type="radio"
                    name="arrangement"
                    checked={type === 'twoSided' && twoSidedOrientation === 'horizontal-edges'}
                    onChange={() => {
                      setType('twoSided');
                      setTwoSidedOrientation('horizontal-edges');
                      const validation = validateNumPins(numPinsText, 'twoSided');
                      setError(validation.error || '');
                    }}
                    style={{ display: 'none' }}
                  />
                  <div className={`custom-radio ${type === 'twoSided' && twoSidedOrientation === 'horizontal-edges' ? 'selected' : ''}`}></div>
                  <TwoSidedIconSVG rotate={90} />
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Individual Components */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#444', marginBottom: '8px', borderBottom: '2px solid #ddd', paddingBottom: '4px' }}>
              Individual Components
            </div>
            
            {/* Linear (1 side) */}
            <label className="radio-label" style={{ marginBottom: '8px' }}>
              <input
                type="radio"
                name="arrangement"
                value="linear"
                checked={type === 'linear'}
                onChange={() => {
                  setType('linear');
                  const validation = validateNumPins(numPinsText, 'linear');
                  setError(validation.error || '');
                }}
                style={{ display: 'none' }}
              />
              <div className={`custom-radio ${type === 'linear' ? 'selected' : ''}`} style={{ marginRight: '10px' }}></div>
              <span style={{ color: '#222', fontSize: '15px' }}>Linear (1 side)</span>
              <LinearIconSVG />
            </label>

            {/* Zig-Zag with Vertical/Horizontal columns */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '10px 30px', alignItems: 'center' }}>
                <div style={{ gridColumn: '2 / 3', color: '#555', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>Vertical {isPad ? 'Pads' : 'Vias'}</div>
                <div style={{ gridColumn: '3 / 4', color: '#555', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>Horizontal {isPad ? 'Pads' : 'Vias'}</div>
                
                <div style={{ color: '#222', fontSize: '15px', fontWeight: 500 }}>Zig-Zag:</div>
                <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', cursor: 'pointer', gap: '12px', justifyContent: 'center' }} className="radio-label">
                  <input
                    type="radio"
                    name="arrangement"
                    checked={type === 'zigzag' && zigzagOrientation === 'vertical'}
                    onChange={() => {
                      setType('zigzag');
                      setZigZagOrientation('vertical');
                      const validation = validateNumPins(numPinsText, 'zigzag');
                      setError(validation.error || '');
                    }}
                    style={{ display: 'none' }}
                  />
                  <div className={`custom-radio ${type === 'zigzag' && zigzagOrientation === 'vertical' ? 'selected' : ''}`}></div>
                  <ZigZagIconSVG />
                </label>
                <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', cursor: 'pointer', gap: '12px', justifyContent: 'center' }} className="radio-label">
                  <input
                    type="radio"
                    name="arrangement"
                    checked={type === 'zigzag' && zigzagOrientation === 'horizontal'}
                    onChange={() => {
                      setType('zigzag');
                      setZigZagOrientation('horizontal');
                      const validation = validateNumPins(numPinsText, 'zigzag');
                      setError(validation.error || '');
                    }}
                    style={{ display: 'none' }}
                  />
                  <div className={`custom-radio ${type === 'zigzag' && zigzagOrientation === 'horizontal' ? 'selected' : ''}`}></div>
                  <ZigZagIconSVG rotate={90} />
                </label>
              </div>
            </div>
          </div>
        </div>

    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '5px', color: '#222', fontWeight: 500 }}>
        Number of Pins:
      </label>
      <input
        type="number"
        min={type === 'linear' ? 1 : (type === 'twoSided' || type === 'zigzag') ? 2 : 4}
        step={type === 'linear' ? 1 : (type === 'twoSided' || type === 'zigzag') ? 2 : 4}
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

