/**
 * Copyright (c) 2025 Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
}) => {
  // Dialog position state - start on the right side of the screen
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Initialize position when dialog becomes visible
  useEffect(() => {
    if (visible && position === null) {
      // Position dialog on the right side, below the menu bar
      const dialogWidth = 320;
      const rightMargin = 20;
      const topMargin = 80; // Below menu bar
      
      setPosition({
        x: window.innerWidth - dialogWidth - rightMargin,
        y: topMargin,
      });
    }
  }, [visible, position]);

  // Reset position when dialog is closed
  useEffect(() => {
    if (!visible) {
      setPosition(null);
    }
  }, [visible]);

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
      
      const clampedX = Math.max(0, Math.min(newX, window.innerWidth - dialogWidth));
      const clampedY = Math.max(0, Math.min(newY, window.innerHeight - dialogHeight));
      
      setPosition({ x: clampedX, y: clampedY });
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
  }, [isDragging]);

  // Switch to Bottom View (flip horizontal)
  // This now modifies the VIEW transform, not object properties
  const handleSwitchToBottomView = useCallback(() => {
    if (isBottomView) return; // Already in bottom view
    setViewFlipX(true);
    setIsBottomView(true);
  }, [isBottomView, setViewFlipX, setIsBottomView]);

  // Switch to Top View (reset flip)
  // This now modifies the VIEW transform, not object properties
  const handleSwitchToTopView = useCallback(() => {
    if (!isBottomView) return; // Already in top view
    setViewFlipX(false);
    setIsBottomView(false);
  }, [isBottomView, setViewFlipX, setIsBottomView]);

  // Rotate by specified angle (clockwise)
  // This now modifies the VIEW transform, not object properties
  const handleRotate = useCallback((angle: number) => {
    setViewRotation(prev => addAngles(prev, angle));
  }, [setViewRotation, addAngles]);

  if (!visible) return null;

  // Common button style
  const buttonStyle = (disabled: boolean = false): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    color: disabled ? '#666' : '#f2f2f2',
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
        top: position?.y ?? 80,
        left: position?.x ?? window.innerWidth - 340,
        backgroundColor: '#2b2b31',
        borderRadius: 8,
        minWidth: '320px',
        maxWidth: '400px',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        border: '1px solid #1f1f24',
        zIndex: 10001,
      }}
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: 'linear-gradient(to bottom, #3a3a42, #2b2b31)',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottom: '1px solid #1f1f24',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#888', fontSize: '14px' }}>⋮⋮</span>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#f2f2f2' }}>
            Change Perspective
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '2px 6px',
            lineHeight: 1,
            borderRadius: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#444';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#888';
          }}
        >
          ✕
        </button>
      </div>

      {/* Dialog Content */}
      <div style={{ padding: '16px' }}>
        {/* View Switching */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
            View:
          </div>
          <button
            onClick={isBottomView ? handleSwitchToTopView : handleSwitchToBottomView}
            style={buttonStyle(false)}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {isBottomView ? 'Switch to Top View' : 'Switch to Bottom View'}
          </button>
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

        {/* Rotation */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
            Rotate (clockwise):
          </div>
          <button
            onClick={() => handleRotate(90)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 90°
          </button>
          <button
            onClick={() => handleRotate(180)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 180°
          </button>
          <button
            onClick={() => handleRotate(270)}
            style={buttonStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rotate 270°
          </button>
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

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

