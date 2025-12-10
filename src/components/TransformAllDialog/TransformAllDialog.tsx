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
  
  // View transform state (needed for center calculation in world coordinates)
  viewPan: { x: number; y: number };
  viewScale: number;
  contentBorder: number;
}

export const TransformAllDialog: React.FC<TransformAllDialogProps> = ({
  visible,
  onClose,
  topImage,
  bottomImage,
  setTopImage,
  setBottomImage,
  componentsTop: _componentsTop,
  componentsBottom: _componentsBottom,
  setComponentsTop,
  setComponentsBottom,
  drawingStrokes: _drawingStrokes,
  setDrawingStrokes,
  powerSymbols,
  groundSymbols,
  setPowerSymbols,
  setGroundSymbols,
  canvasRef,
  isBottomView,
  setIsBottomView,
  originalTopFlipX,
  setOriginalTopFlipX,
  originalBottomFlipX,
  setOriginalBottomFlipX,
  originalTopFlipY,
  setOriginalTopFlipY,
  originalBottomFlipY,
  setOriginalBottomFlipY,
  viewPan,
  viewScale,
  contentBorder,
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

  // Calculate center point for transformations in world coordinates
  // Use the top image's center as the reference point to ensure consistent
  // transformations that are not affected by the offset between top and bottom images
  const getCenterPoint = (): { x: number; y: number } => {
    // Use top image center as reference (or bottom if top doesn't exist)
    // This ensures the center point is consistent and not affected by image offset
    if (topImage) {
      return {
        x: topImage.x,
        y: topImage.y,
      };
    }
    if (bottomImage) {
      return {
        x: bottomImage.x,
        y: bottomImage.y,
      };
    }
    
    // If no images, use (0, 0) as the center
    return { x: 0, y: 0 };
  };

  // Switch to Bottom View (flip horizontal)
  const handleSwitchToBottomView = useCallback(() => {
    if (isBottomView) return; // Already in bottom view
    
    const center = getCenterPoint();
    const centerX = center.x;
    
    // Helper function to flip image around vertical axis in world coordinates
    // Transformation order: translate -> rotate -> scale(flipX, flipY)
    // To flip around vertical axis in world (world X axis), we need to flip around
    // the axis that is horizontal in world coordinates after rotation.
    // At 0° or 180°: local X is horizontal in world -> flipX
    // At 90° or 270°: local Y is horizontal in world -> flipY
    const flipImageVertical = (image: PCBImage | null) => {
      if (!image) return null;
      const rotation = (image.rotation || 0) % 360;
      const normalizedRotation = rotation < 0 ? rotation + 360 : rotation;
      
      // Use tolerance for floating point comparisons (within 1 degree)
      const tolerance = 1;
      
      // At 0° or 180°: flip around X axis (horizontal flip in local = horizontal flip in world)
      if ((normalizedRotation >= 0 && normalizedRotation < tolerance) || 
          (normalizedRotation >= 180 - tolerance && normalizedRotation < 180 + tolerance) ||
          (normalizedRotation >= 360 - tolerance)) {
        return { ...image, flipX: !image.flipX };
      } 
      // At 90° or 270°: flip around Y axis (vertical flip in local = horizontal flip in world)
      else if ((normalizedRotation >= 90 - tolerance && normalizedRotation < 90 + tolerance) ||
               (normalizedRotation >= 270 - tolerance && normalizedRotation < 270 + tolerance)) {
        return { ...image, flipY: !image.flipY };
      } 
      // For other rotations, determine which axis is more horizontal in world coordinates
      else {
        // Calculate which local axis is more aligned with world horizontal
        const rad = (normalizedRotation * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        
        // Local X axis direction in world coordinates after rotation
        const localXWorldX = cosR;
        // Local Y axis direction in world coordinates after rotation (Y axis rotated 90° from X)
        const localYWorldX = -sinR;
        
        // Use the axis that is more horizontal (larger absolute X component in world)
        if (Math.abs(localXWorldX) > Math.abs(localYWorldX)) {
          return { ...image, flipX: !image.flipX };
        } else {
          return { ...image, flipY: !image.flipY };
        }
      }
    };
    
    // Save original flipX and flipY state before applying bottom view transform
    // Flip images: toggle flip flags AND flip bottom image position around center to maintain relative offset
    if (topImage) {
      setOriginalTopFlipX(topImage.flipX || false);
      setOriginalTopFlipY(topImage.flipY || false);
      setTopImage(prev => prev ? flipImageVertical(prev) : null);
    } else {
      setOriginalTopFlipX(null);
      setOriginalTopFlipY(null);
    }
    if (bottomImage) {
      setOriginalBottomFlipX(bottomImage.flipX || false);
      setOriginalBottomFlipY(bottomImage.flipY || false);
      const flipped = flipImageVertical(bottomImage);
      if (flipped) {
        // Flip bottom image's X position around center to maintain relative offset with top image
        setBottomImage({
          ...flipped,
          x: centerX - (bottomImage.x - centerX), // Flip x around center
        });
      }
    } else {
      setOriginalBottomFlipX(null);
      setOriginalBottomFlipY(null);
    }
    
    // Flip components horizontally (flip x coordinates around center)
    setComponentsTop(prev => prev.map(comp => ({
      ...comp,
      x: centerX - (comp.x - centerX), // Flip x around center
      orientation: comp.orientation ? (360 - comp.orientation) % 360 : 0, // Flip orientation
    })));
    
    setComponentsBottom(prev => prev.map(comp => ({
      ...comp,
      x: centerX - (comp.x - centerX), // Flip x around center
      orientation: comp.orientation ? (360 - comp.orientation) % 360 : 0, // Flip orientation
    })));
    
    // Flip drawing strokes horizontally (flip all points' x coordinates around center)
    setDrawingStrokes(prev => prev.map(stroke => ({
      ...stroke,
      points: stroke.points.map(point => ({
        ...point,
        x: centerX - (point.x - centerX), // Flip x around center
      })),
    })));
    
    // Flip power symbols horizontally (flip x coordinates around center and toggle flipX)
    setPowerSymbols(prev => prev.map(p => ({
      ...p,
      x: centerX - (p.x - centerX), // Flip x around center
      flipX: !p.flipX, // Toggle flipX
    })));
    
    // Flip ground symbols horizontally (flip x coordinates around center and toggle flipX)
    setGroundSymbols(prev => prev.map(g => ({
      ...g,
      x: centerX - (g.x - centerX), // Flip x around center
      flipX: !g.flipX, // Toggle flipX
    })));
    
    setIsBottomView(true);
  }, [isBottomView, topImage, bottomImage, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setDrawingStrokes, setPowerSymbols, setGroundSymbols, canvasRef, setOriginalTopFlipX, setOriginalBottomFlipX, setOriginalTopFlipY, setOriginalBottomFlipY, viewPan, viewScale, contentBorder]);

  // Switch to Top View (reset flip)
  const handleSwitchToTopView = useCallback(() => {
    if (!isBottomView) return; // Already in top view
    
    const center = getCenterPoint();
    const centerX = center.x;
    
    // Helper function to flip image back around vertical axis in world coordinates
    // Use the same logic as when switching to bottom view - flip using the same method
    const flipImageVertical = (image: PCBImage | null) => {
      if (!image) return null;
      const rotation = (image.rotation || 0) % 360;
      const normalizedRotation = rotation < 0 ? rotation + 360 : rotation;
      
      // Use tolerance for floating point comparisons (within 1 degree)
      const tolerance = 1;
      
      // At 0° or 180°: flip around X axis (horizontal flip in local = horizontal flip in world)
      if ((normalizedRotation >= 0 && normalizedRotation < tolerance) || 
          (normalizedRotation >= 180 - tolerance && normalizedRotation < 180 + tolerance) ||
          (normalizedRotation >= 360 - tolerance)) {
        return { ...image, flipX: !image.flipX };
      } 
      // At 90° or 270°: flip around Y axis (vertical flip in local = horizontal flip in world)
      else if ((normalizedRotation >= 90 - tolerance && normalizedRotation < 90 + tolerance) ||
               (normalizedRotation >= 270 - tolerance && normalizedRotation < 270 + tolerance)) {
        return { ...image, flipY: !image.flipY };
      } 
      // For other rotations, determine which axis is more horizontal in world coordinates
      else {
        // Calculate which local axis is more aligned with world horizontal
        const rad = (normalizedRotation * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        
        // Local X axis direction in world coordinates after rotation
        const localXWorldX = cosR;
        // Local Y axis direction in world coordinates after rotation (Y axis rotated 90° from X)
        const localYWorldX = -sinR;
        
        // Use the axis that is more horizontal (larger absolute X component in world)
        if (Math.abs(localXWorldX) > Math.abs(localYWorldX)) {
          return { ...image, flipX: !image.flipX };
        } else {
          return { ...image, flipY: !image.flipY };
        }
      }
    };
    
    // Flip back using the same logic (don't just restore - flip again to undo)
    // Flip images: toggle flip flags AND flip bottom image position around center to maintain relative offset
    if (topImage) {
      setTopImage(prev => prev ? flipImageVertical(prev) : null);
    }
    if (bottomImage) {
      const flipped = flipImageVertical(bottomImage);
      if (flipped) {
        // Flip bottom image's X position around center to maintain relative offset with top image
        setBottomImage({
          ...flipped,
          x: centerX - (bottomImage.x - centerX), // Flip x around center
        });
      }
    }
    
    // Flip components back (flip x coordinates around center again)
    setComponentsTop(prev => prev.map(comp => ({
      ...comp,
      x: centerX - (comp.x - centerX), // Flip x around center again
      orientation: comp.orientation ? (360 - comp.orientation) % 360 : 0, // Flip orientation back
    })));
    
    setComponentsBottom(prev => prev.map(comp => ({
      ...comp,
      x: centerX - (comp.x - centerX), // Flip x around center again
      orientation: comp.orientation ? (360 - comp.orientation) % 360 : 0, // Flip orientation back
    })));
    
    // Flip drawing strokes back
    setDrawingStrokes(prev => prev.map(stroke => ({
      ...stroke,
      points: stroke.points.map(point => ({
        ...point,
        x: centerX - (point.x - centerX), // Flip x around center again
      })),
    })));
    
    // Flip power symbols back (flip x coordinates around center again and toggle flipX)
    setPowerSymbols(prev => prev.map(p => ({
      ...p,
      x: centerX - (p.x - centerX), // Flip x around center again
      flipX: !p.flipX, // Toggle flipX back
    })));
    
    // Flip ground symbols back (flip x coordinates around center again and toggle flipX)
    setGroundSymbols(prev => prev.map(g => ({
      ...g,
      x: centerX - (g.x - centerX), // Flip x around center again
      flipX: !g.flipX, // Toggle flipX back
    })));
    
    setIsBottomView(false);
  }, [isBottomView, topImage, bottomImage, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setDrawingStrokes, setPowerSymbols, setGroundSymbols, canvasRef, originalTopFlipX, originalBottomFlipX, originalTopFlipY, originalBottomFlipY, viewPan, viewScale, contentBorder]);

  // Rotate by specified angle (clockwise)
  const handleRotate = useCallback((angle: number) => {
    const center = getCenterPoint();
    const centerX = center.x;
    const centerY = center.y;
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    // Rotate point around center (used for both images and components)
    const rotatePoint = (x: number, y: number): { x: number; y: number } => {
      const dx = x - centerX;
      const dy = y - centerY;
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      };
    };
    
    // Rotate images - rotate their position around canvas center AND add to rotation
    if (topImage) {
      const rotatedPos = rotatePoint(topImage.x, topImage.y);
      const newRotation = ((topImage.rotation || 0) + angle) % 360;
      setTopImage(prev => prev ? { 
        ...prev, 
        x: rotatedPos.x,
        y: rotatedPos.y,
        rotation: newRotation 
      } : null);
    }
    if (bottomImage) {
      const rotatedPos = rotatePoint(bottomImage.x, bottomImage.y);
      const newRotation = ((bottomImage.rotation || 0) + angle) % 360;
      setBottomImage(prev => prev ? { 
        ...prev, 
        x: rotatedPos.x,
        y: rotatedPos.y,
        rotation: newRotation 
      } : null);
    }
    
    // Rotate components
    
    setComponentsTop(prev => prev.map(comp => {
      const rotated = rotatePoint(comp.x, comp.y);
      const newOrientation = comp.orientation ? ((comp.orientation + angle) % 360) : angle;
      return {
        ...comp,
        x: rotated.x,
        y: rotated.y,
        orientation: newOrientation,
      };
    }));
    
    setComponentsBottom(prev => prev.map(comp => {
      const rotated = rotatePoint(comp.x, comp.y);
      const newOrientation = comp.orientation ? ((comp.orientation + angle) % 360) : angle;
      return {
        ...comp,
        x: rotated.x,
        y: rotated.y,
        orientation: newOrientation,
      };
    }));
    
    // Rotate drawing strokes
    setDrawingStrokes(prev => prev.map(stroke => ({
      ...stroke,
      points: stroke.points.map(point => {
        const rotated = rotatePoint(point.x, point.y);
        return {
          ...point,
          x: rotated.x,
          y: rotated.y,
        };
      }),
    })));
    
    // Rotate power symbols
    setPowerSymbols(prev => prev.map(p => {
      const rotated = rotatePoint(p.x, p.y);
      const newRotation = ((p.rotation || 0) + angle) % 360;
      return {
        ...p,
        x: rotated.x,
        y: rotated.y,
        rotation: newRotation,
      };
    }));
    
    // Rotate ground symbols
    setGroundSymbols(prev => prev.map(g => {
      const rotated = rotatePoint(g.x, g.y);
      const newRotation = ((g.rotation || 0) + angle) % 360;
      return {
        ...g,
        x: rotated.x,
        y: rotated.y,
        rotation: newRotation,
      };
    }));
    
  }, [topImage, bottomImage, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setDrawingStrokes, setPowerSymbols, setGroundSymbols, canvasRef, viewPan, viewScale, contentBorder]);

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

