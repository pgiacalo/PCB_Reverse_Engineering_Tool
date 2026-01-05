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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PCBImage } from '../../hooks/useImage';
import type { PCBComponent } from '../../types';
import type { DrawingStroke } from '../../hooks/useDrawing';
import type { PowerSymbol, GroundSymbol } from '../../hooks/usePowerGround';
import {
  addAngles,
} from '../../utils/transformations';

export interface TransformAllDialogProps {
  visible: boolean;
  onClose: () => void;
  
  // Image state
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  setTopImage: React.Dispatch<React.SetStateAction<PCBImage | null>>;
  setBottomImage: React.Dispatch<React.SetStateAction<PCBImage | null>>;
  
  // Component state
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  setComponentsTop: React.Dispatch<React.SetStateAction<PCBComponent[]>>;
  setComponentsBottom: React.Dispatch<React.SetStateAction<PCBComponent[]>>;
  
  // Drawing strokes state
  drawingStrokes: DrawingStroke[];
  setDrawingStrokes: React.Dispatch<React.SetStateAction<DrawingStroke[]>>;
  
  // Power and ground symbols state
  powerSymbols: PowerSymbol[];
  groundSymbols: GroundSymbol[];
  setPowerSymbols: React.Dispatch<React.SetStateAction<PowerSymbol[]>>;
  setGroundSymbols: React.Dispatch<React.SetStateAction<GroundSymbol[]>>;
  
  // Canvas ref for calculating center
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  
  // View state (tracked in parent)
  isBottomView: boolean;
  setIsBottomView: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Track original flipX and flipY state before bottom view transform
  originalTopFlipX: boolean | null;
  setOriginalTopFlipX: React.Dispatch<React.SetStateAction<boolean | null>>;
  originalBottomFlipX: boolean | null;
  setOriginalBottomFlipX: React.Dispatch<React.SetStateAction<boolean | null>>;
  originalTopFlipY: boolean | null;
  setOriginalTopFlipY: React.Dispatch<React.SetStateAction<boolean | null>>;
  originalBottomFlipY: boolean | null;
  setOriginalBottomFlipY: React.Dispatch<React.SetStateAction<boolean | null>>;
  
  // View transform state (camera in world coordinates for consistency)
  cameraWorldCenter: { x: number; y: number };
  setCameraWorldCenter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  viewScale: number;
  viewRotation: number;
  setViewRotation: React.Dispatch<React.SetStateAction<number>>;
  viewFlipX: boolean;
  setViewFlipX: React.Dispatch<React.SetStateAction<boolean>>;
  contentBorder: number;
  
  // Transparency state
  setTransparency: React.Dispatch<React.SetStateAction<number>>;
}

export const TransformAllDialog: React.FC<TransformAllDialogProps> = ({
  visible,
  onClose,
  topImage: _topImage,
  bottomImage: _bottomImage,
  setTopImage: _setTopImage,
  setBottomImage: _setBottomImage,
  componentsTop: _componentsTop,
  componentsBottom: _componentsBottom,
  setComponentsTop: _setComponentsTop,
  setComponentsBottom: _setComponentsBottom,
  drawingStrokes: _drawingStrokes,
  setDrawingStrokes: _setDrawingStrokes,
  powerSymbols: _powerSymbols,
  groundSymbols: _groundSymbols,
  setPowerSymbols: _setPowerSymbols,
  setGroundSymbols: _setGroundSymbols,
  canvasRef: _canvasRef,
  isBottomView,
  setIsBottomView,
  originalTopFlipX: _originalTopFlipX,
  setOriginalTopFlipX: _setOriginalTopFlipX,
  originalBottomFlipX: _originalBottomFlipX,
  setOriginalBottomFlipX: _setOriginalBottomFlipX,
  originalTopFlipY: _originalTopFlipY,
  setOriginalTopFlipY: _setOriginalTopFlipY,
  originalBottomFlipY: _originalBottomFlipY,
  setOriginalBottomFlipY: _setOriginalBottomFlipY,
  cameraWorldCenter: _cameraWorldCenter,
  setCameraWorldCenter: _setCameraWorldCenter,
  viewScale: _viewScale,
  viewRotation: _viewRotation,
  setViewRotation,
  viewFlipX: _viewFlipX,
  setViewFlipX,
  contentBorder: _contentBorder,
  setTransparency,
}) => {
  // Dialog position state - start on the right side of the screen
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Constrain dialog position to window boundaries
  const constrainDialogPosition = useCallback((x: number, y: number, dialogWidth: number, dialogHeight: number): { x: number; y: number } => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 10; // Padding from edges
    
    // Constrain x position (prevent overflow on right edge, ensure not negative)
    const clampedX = Math.max(padding, Math.min(x, windowWidth - dialogWidth - padding));
    
    // Constrain y position (prevent overflow on bottom edge, ensure not negative)
    const clampedY = Math.max(padding, Math.min(y, windowHeight - dialogHeight - padding));
    
    return { x: clampedX, y: clampedY };
  }, []);

  // Initialize position when dialog becomes visible (load from localStorage or use default)
  useEffect(() => {
    if (visible && position === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('transformAllDialogPosition');
      const dialogWidth = 320;
      const dialogHeight = 400; // Approximate height
      const rightMargin = 20;
      const topMargin = 150; // Lower default position to avoid covering file name
      
      let initialPosition: { x: number; y: number };
      
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          // Constrain saved position to window boundaries
          initialPosition = constrainDialogPosition(savedPosition.x, savedPosition.y, dialogWidth, dialogHeight);
        } catch {
          // If parsing fails, use default position
          initialPosition = constrainDialogPosition(
            window.innerWidth - dialogWidth - rightMargin,
            topMargin,
            dialogWidth,
            dialogHeight
          );
    }
      } else {
        // No saved position, use default position (lower to avoid covering file name)
        initialPosition = constrainDialogPosition(
          window.innerWidth - dialogWidth - rightMargin,
          topMargin,
          dialogWidth,
          dialogHeight
        );
      }
      
      setPosition(initialPosition);
    }
    // Don't reset position when dialog closes - keep it for next time
  }, [visible, position, constrainDialogPosition]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setIsDragging(true);
    }
  }, []);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      // Keep dialog within viewport bounds
      const dialogWidth = dialogRef.current?.offsetWidth || 320;
      const dialogHeight = dialogRef.current?.offsetHeight || 400;
      
      // Constrain position to window boundaries
      const newPosition = constrainDialogPosition(newX, newY, dialogWidth, dialogHeight);
      
      setPosition(newPosition);
      // Save position to localStorage
      localStorage.setItem('transformAllDialogPosition', JSON.stringify(newPosition));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, constrainDialogPosition]);

  // Switch to Bottom View (flip horizontal)
  // This now modifies the VIEW transform, not object properties
  const handleSwitchToBottomView = useCallback(() => {
    if (isBottomView) return; // Already in bottom view
    setViewFlipX(true);
    setIsBottomView(true);
    setTransparency(100); // 100 = bottom image fully opaque, only bottom visible
  }, [isBottomView, setViewFlipX, setIsBottomView, setTransparency]);

  // Switch to Top View (reset flip)
  // This now modifies the VIEW transform, not object properties
  const handleSwitchToTopView = useCallback(() => {
    if (!isBottomView) return; // Already in top view
    setViewFlipX(false);
    setIsBottomView(false);
    setTransparency(0); // 0 = bottom image transparent, only top visible
  }, [isBottomView, setViewFlipX, setIsBottomView, setTransparency]);

  // Rotate by specified angle (clockwise)
  // This now modifies the VIEW transform, not object properties
  const handleRotate = useCallback((angle: number) => {
    setViewRotation(prev => addAngles(prev, angle));
  }, [setViewRotation, addAngles]);

  if (!visible) return null;

  // Common button style (matching Information dialog)
  const buttonStyle = (disabled: boolean = false): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    color: disabled ? '#999' : '#222',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    transition: 'background 0.15s',
  });

  return (
    <div
      ref={dialogRef}
      style={{
        position: 'fixed',
        top: position?.y ?? 150,
        left: position?.x ?? window.innerWidth - 340,
        backgroundColor: '#fff',
        borderRadius: 8,
        minWidth: '320px',
        maxWidth: '400px',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        border: '1px solid #ddd',
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px',
          borderBottom: '1px solid #e0e0e0',
          background: '#888',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>
            Change Perspective
          </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            color: '#fff',
            padding: 0,
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Dialog Content */}
      <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
        {/* View Switching */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: 500 }}>
            View:
          </div>
          <button
            onClick={isBottomView ? handleSwitchToTopView : handleSwitchToBottomView}
            style={buttonStyle(false)}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {isBottomView ? 'Switch to Top View' : 'Switch to Bottom View'}
          </button>
          <div style={{ fontSize: '10px', color: '#999', marginTop: '6px', fontStyle: 'italic' }}>
            Shortcut: Shift-Left/Right Arrow Keys
          </div>
        </div>

        <div style={{ height: 1, background: '#e0e0e0', margin: '16px 0' }} />

        {/* Rotation */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: 500 }}>
            Rotate (clockwise):
          </div>
          <button
            onClick={() => handleRotate(45)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 45°
          </button>
          <button
            onClick={() => handleRotate(90)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 90°
          </button>
          <button
            onClick={() => handleRotate(180)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 180°
          </button>
          <button
            onClick={() => handleRotate(270)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 270°
          </button>
          <div style={{ fontSize: '10px', color: '#999', marginTop: '6px', fontStyle: 'italic' }}>
            Shortcut: Shift-Up/Down Arrow Keys
          </div>
        </div>

        <div style={{ height: 1, background: '#e0e0e0', margin: '16px 0' }} />

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#4a9eff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a8ee6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#4a9eff')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransformAllDialog;

