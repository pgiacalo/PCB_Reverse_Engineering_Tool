/**
 * Landmark Alignment Dialog
 * 
 * Guides user through:
 * 1. Selecting flip direction for bottom image
 * 2. Applying the flip
 * 3. Placing 4 landmarks on each image
 * 4. Calculating alignment (translation, scale, rotation)
 */

import React, { useState } from 'react';

export interface LandmarkPoint {
  x: number;
  y: number;
}

export type FlipDirection = 'horizontal' | 'vertical';

export interface LandmarkAlignmentDialogProps {
  visible: boolean;
  onClose: () => void;
  onApplyFlip: (direction: FlipDirection) => void;
  onStartLandmarkSelection: () => void;
  topLandmarks: LandmarkPoint[];
  bottomLandmarks: LandmarkPoint[];
  onCalculateAlignment: () => void;
  onClearLandmarks: () => void;
  currentStep: 'select-flip' | 'select-top' | 'select-bottom' | 'ready' | 'idle';
  flipApplied: FlipDirection | null;
}

// Colors for landmarks
const TOP_LANDMARK_COLOR = '#FF6B00'; // Orange for top
const BOTTOM_LANDMARK_COLOR = '#00BFFF'; // Cyan for bottom

/**
 * SVG diagram showing landmark placement order
 * 
 * Since the flip is applied BEFORE landmarks are placed, both diagrams
 * show the same clockwise order: 1=TL, 2=TR, 3=BR, 4=BL
 */
const LandmarkDiagram: React.FC<{ isBottom: boolean; count: number; isBottomLabel?: boolean }> = ({ 
  isBottom, 
  count, 
  isBottomLabel = false 
}) => {
  const useBottomColor = isBottom || isBottomLabel;
  const color = useBottomColor ? BOTTOM_LANDMARK_COLOR : TOP_LANDMARK_COLOR;
  const label = isBottomLabel ? 'BOTTOM' : (isBottom ? 'BOTTOM' : 'TOP');
  
  // Both use the same clockwise order since flip is already applied
  const positions = [
    { x: 25, y: 20, num: 1 },   // Top-left
    { x: 75, y: 20, num: 2 },   // Top-right
    { x: 75, y: 60, num: 3 },   // Bottom-right
    { x: 25, y: 60, num: 4 },   // Bottom-left
  ];

  return (
    <svg width="100" height="85" viewBox="0 0 100 85" style={{ display: 'block' }}>
      {/* Board outline */}
      <rect 
        x="10" y="10" width="80" height="60" 
        fill="#2a2a2a" 
        stroke="#666" 
        strokeWidth="1" 
        rx="3"
      />
      
      {/* Label */}
      <text 
        x="50" y="8" 
        textAnchor="middle" 
        fill={color} 
        fontSize="9" 
        fontWeight="bold"
      >
        {label}
      </text>
      
      
      {/* Landmark positions */}
      {positions.map((pos, i) => {
        const isPlaced = i < count;
        const isNext = i === count;
        
        return (
          <g key={i}>
            {/* Outer circle */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isNext ? 10 : 8}
              fill={isPlaced ? color : 'transparent'}
              stroke={isPlaced ? color : isNext ? color : '#555'}
              strokeWidth={isNext ? 2 : 1}
              strokeDasharray={isPlaced ? 'none' : '3,2'}
            />
            {/* Number */}
            <text
              x={pos.x}
              y={pos.y + 3}
              textAnchor="middle"
              fill={isPlaced ? 'white' : isNext ? color : '#777'}
              fontSize="10"
              fontWeight="bold"
            >
              {pos.num}
            </text>
          </g>
        );
      })}
      
      {/* Direction indicator */}
      <text x="50" y="78" textAnchor="middle" fill="#666" fontSize="7">
        clockwise order
      </text>
    </svg>
  );
};

/**
 * Step indicator showing current progress
 */
const StepIndicator: React.FC<{ 
  step: number; 
  label: string; 
  isActive: boolean; 
  isComplete: boolean;
  color: string;
}> = ({ step, label, isActive, isComplete, color }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px',
    padding: '6px 10px',
    backgroundColor: isActive ? `${color}20` : 'transparent',
    borderRadius: '4px',
    border: isActive ? `2px solid ${color}` : '2px solid transparent'
  }}>
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: isComplete ? color : isActive ? color : '#444',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: 'bold'
    }}>
      {isComplete ? '✓' : step}
    </div>
    <span style={{ 
      color: isActive ? color : isComplete ? '#aaa' : '#666',
      fontSize: '13px',
      fontWeight: isActive ? 600 : 400
    }}>
      {label}
    </span>
  </div>
);

export const LandmarkAlignmentDialog: React.FC<LandmarkAlignmentDialogProps> = ({
  visible,
  onClose,
  onApplyFlip,
  onStartLandmarkSelection,
  topLandmarks,
  bottomLandmarks,
  onCalculateAlignment,
  onClearLandmarks,
  currentStep,
  flipApplied,
}) => {
  const [selectedFlip, setSelectedFlip] = useState<FlipDirection>('horizontal');
  const topCount = topLandmarks.length;
  const bottomCount = bottomLandmarks.length;
  const isReady = topCount === 4 && bottomCount === 4;

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        paddingTop: '80px',
        paddingRight: '20px',
        zIndex: 10000,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          backgroundColor: '#1e1e1e',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          width: '340px',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          pointerEvents: 'auto',
          border: '1px solid #444'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '12px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, color: '#f2f2f2', fontSize: '16px' }}>
            Manual Landmark Alignment
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#999',
              padding: '0 4px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          
          {/* STEP 1: Flip Selection (only shown when step is 'idle' or 'select-flip') */}
          {(currentStep === 'idle' || currentStep === 'select-flip') && !flipApplied && (
            <>
              <div style={{ 
                backgroundColor: '#2a2a2a', 
                borderRadius: '6px', 
                padding: '12px',
                marginBottom: '16px'
              }}>
                <p style={{ 
                  margin: '0 0 8px 0', 
                  color: '#ccc', 
                  fontSize: '12px',
                  lineHeight: 1.5
                }}>
                  <strong>Step 1:</strong> The bottom PCB photo needs to be flipped to match 
                  the top view. Select the flip direction:
                </p>
              </div>

              {/* Flip Direction Radio Buttons */}
              <div style={{ 
                backgroundColor: '#333', 
                borderRadius: '6px', 
                padding: '12px',
                marginBottom: '16px'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: selectedFlip === 'horizontal' ? '#2196F320' : 'transparent',
                  marginBottom: '8px'
                }}>
                  <input
                    type="radio"
                    name="flipDirection"
                    value="horizontal"
                    checked={selectedFlip === 'horizontal'}
                    onChange={() => setSelectedFlip('horizontal')}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ color: '#f2f2f2', fontSize: '14px', fontWeight: 500 }}>
                      ↔ Horizontal Flip
                    </div>
                    <div style={{ color: '#888', fontSize: '11px' }}>
                      Mirror left-to-right (most common for PCBs)
                    </div>
                  </div>
                </label>
                
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: selectedFlip === 'vertical' ? '#2196F320' : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="flipDirection"
                    value="vertical"
                    checked={selectedFlip === 'vertical'}
                    onChange={() => setSelectedFlip('vertical')}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <div style={{ color: '#f2f2f2', fontSize: '14px', fontWeight: 500 }}>
                      ↕ Vertical Flip
                    </div>
                    <div style={{ color: '#888', fontSize: '11px' }}>
                      Mirror top-to-bottom
                    </div>
                  </div>
                </label>
              </div>

              <button
                onClick={() => onApplyFlip(selectedFlip)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}
              >
                Apply Flip & Continue
              </button>
            </>
          )}

          {/* STEP 2-4: Landmark Selection (shown after flip is applied) */}
          {flipApplied && (
            <>
              {/* Flip confirmation */}
              <div style={{ 
                backgroundColor: '#4CAF5020', 
                border: '1px solid #4CAF50',
                borderRadius: '6px', 
                padding: '10px 12px',
                marginBottom: '16px',
                fontSize: '12px',
                color: '#4CAF50'
              }}>
                ✓ Bottom image flipped <strong>{flipApplied === 'horizontal' ? 'horizontally' : 'vertically'}</strong>
              </div>

              {/* Instructions */}
              <div style={{ 
                backgroundColor: '#2a2a2a', 
                borderRadius: '6px', 
                padding: '12px',
                marginBottom: '16px'
              }}>
                <p style={{ 
                  margin: 0, 
                  color: '#ccc', 
                  fontSize: '12px',
                  lineHeight: 1.5
                }}>
                  <strong>Step 2:</strong> Mark <strong>4 matching features</strong> (mounting holes, 
                  corners, pads) on both images. Click the <strong>same physical features</strong> in 
                  the <strong>same clockwise order</strong>.
                </p>
              </div>

              {/* Step Progress */}
              <div style={{ marginBottom: '16px' }}>
                <StepIndicator
                  step={2}
                  label={`Mark TOP image (${topCount}/4)`}
                  isActive={currentStep === 'select-top'}
                  isComplete={topCount === 4}
                  color={TOP_LANDMARK_COLOR}
                />
                <div style={{ 
                  width: '2px', 
                  height: '12px', 
                  backgroundColor: '#444', 
                  marginLeft: '11px' 
                }} />
                <StepIndicator
                  step={3}
                  label={`Mark BOTTOM image (${bottomCount}/4)`}
                  isActive={currentStep === 'select-bottom'}
                  isComplete={bottomCount === 4}
                  color={BOTTOM_LANDMARK_COLOR}
                />
                <div style={{ 
                  width: '2px', 
                  height: '12px', 
                  backgroundColor: '#444', 
                  marginLeft: '11px' 
                }} />
                <StepIndicator
                  step={4}
                  label="Calculate alignment"
                  isActive={currentStep === 'ready'}
                  isComplete={false}
                  color="#4CAF50"
                />
              </div>

              {/* Diagrams - now both show same orientation since flip is already applied */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  textAlign: 'center',
                  opacity: currentStep === 'select-top' ? 1 : 0.6
                }}>
                  <LandmarkDiagram isBottom={false} count={topCount} />
                </div>
                <div style={{ 
                  textAlign: 'center',
                  opacity: currentStep === 'select-bottom' ? 1 : 0.6
                }}>
                  {/* Since flip is already applied, bottom diagram shows same orientation as top */}
                  <LandmarkDiagram isBottom={false} count={bottomCount} isBottomLabel={true} />
                </div>
              </div>

              {/* Current Status */}
              {(currentStep === 'select-top' || currentStep === 'select-bottom' || currentStep === 'ready') && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: currentStep === 'select-top' ? `${TOP_LANDMARK_COLOR}15` :
                                 currentStep === 'select-bottom' ? `${BOTTOM_LANDMARK_COLOR}15` :
                                 '#4CAF5015',
                  border: `1px solid ${
                    currentStep === 'select-top' ? TOP_LANDMARK_COLOR :
                    currentStep === 'select-bottom' ? BOTTOM_LANDMARK_COLOR :
                    '#4CAF50'
                  }`,
                  borderRadius: '4px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  {currentStep === 'select-top' && (
                    <span style={{ color: TOP_LANDMARK_COLOR, fontSize: '13px' }}>
                      👆 Click 4 landmarks on the <strong>TOP</strong> image (clockwise)
                    </span>
                  )}
                  {currentStep === 'select-bottom' && (
                    <span style={{ color: BOTTOM_LANDMARK_COLOR, fontSize: '13px' }}>
                      👆 Click the <strong>same 4 features</strong> on the <strong>BOTTOM</strong> image
                    </span>
                  )}
                  {currentStep === 'ready' && (
                    <span style={{ color: '#4CAF50', fontSize: '13px' }}>
                      ✓ Ready! Click <strong>Calculate Alignment</strong> below
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentStep === 'idle' && flipApplied && (
                  <button
                    onClick={onStartLandmarkSelection}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    ▶ Start Landmark Selection
                  </button>
                )}

                {(currentStep === 'select-top' || currentStep === 'select-bottom') && (
                  <button
                    onClick={onClearLandmarks}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ↺ Clear Landmarks & Restart
                  </button>
                )}

                {isReady && (
                  <>
                    <button
                      onClick={onCalculateAlignment}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600
                      }}
                    >
                      ✓ Calculate Alignment
                    </button>
                    <button
                      onClick={onClearLandmarks}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#555',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      ↺ Clear & Restart
                    </button>
                  </>
                )}
              </div>

              {/* Tips */}
              <div style={{ 
                marginTop: '16px',
                padding: '10px 12px',
                backgroundColor: '#2a2a2a',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#888',
                lineHeight: 1.5
              }}>
                <strong style={{ color: '#aaa' }}>💡 Tips:</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px' }}>
                  <li>Use mounting holes or distinctive pads that pass through the board</li>
                  <li>Choose points spread across the entire board</li>
                  <li>Click features in the same clockwise order on both images</li>
                  <li>Zoom in for more precise placement</li>
                </ul>
              </div>
            </>
          )}

          {/* Cancel button - always visible */}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#999',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              marginTop: flipApplied ? '8px' : '0'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
