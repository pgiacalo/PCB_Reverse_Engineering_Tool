import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PCBImage } from '../../hooks/useImage';
import type { PCBComponent } from '../../types';
import type { DrawingStroke } from '../../hooks/useDrawing';

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
  
  // Canvas ref for calculating center
  canvasRef: React.RefObject<HTMLCanvasElement>;
  
  // View state (tracked in parent)
  isBottomView: boolean;
  setIsBottomView: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Track original flipX state before bottom view transform
  originalTopFlipX: boolean | null;
  setOriginalTopFlipX: React.Dispatch<React.SetStateAction<boolean | null>>;
  originalBottomFlipX: boolean | null;
  setOriginalBottomFlipX: React.Dispatch<React.SetStateAction<boolean | null>>;
  
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
  componentsTop,
  componentsBottom,
  setComponentsTop,
  setComponentsBottom,
  drawingStrokes,
  setDrawingStrokes,
  canvasRef,
  isBottomView,
  setIsBottomView,
  originalTopFlipX,
  setOriginalTopFlipX,
  originalBottomFlipX,
  setOriginalBottomFlipX,
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
  const getCenterPoint = (): { x: number; y: number } => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      // Calculate content area center in content coordinates (after CONTENT_BORDER translation)
      const contentWidth = canvas.width - 2 * contentBorder;
      const contentHeight = canvas.height - 2 * contentBorder;
      const contentCenterX = contentWidth / 2;
      const contentCenterY = contentHeight / 2;
      
      // Convert to world coordinates
      // The drawing transform is: translate(CONTENT_BORDER, CONTENT_BORDER) then translate(viewPan) then scale(viewScale)
      // So a world coordinate (x, y) is drawn at canvas coordinate:
      //   CONTENT_BORDER + viewPan.x + x * viewScale
      // To reverse: worldX = (contentCoord - viewPan.x) / viewScale
      // The content center in content coordinates is (contentCenterX, contentCenterY)
      const worldCenterX = (contentCenterX - viewPan.x) / viewScale;
      const worldCenterY = (contentCenterY - viewPan.y) / viewScale;
      
      return {
        x: worldCenterX,
        y: worldCenterY,
      };
    }
    // Fallback to 0,0 if canvas not available
    return { x: 0, y: 0 };
  };

  // Switch to Bottom View (flip horizontal)
  const handleSwitchToBottomView = useCallback(() => {
    if (isBottomView) return; // Already in bottom view
    
    const center = getCenterPoint();
    const centerX = center.x;
    
    // Save original flipX state before applying bottom view transform
    if (topImage) {
      setOriginalTopFlipX(topImage.flipX || false);
      setTopImage(prev => prev ? { ...prev, flipX: !prev.flipX } : null);
    } else {
      setOriginalTopFlipX(null);
    }
    if (bottomImage) {
      setOriginalBottomFlipX(bottomImage.flipX || false);
      setBottomImage(prev => prev ? { ...prev, flipX: !prev.flipX } : null);
    } else {
      setOriginalBottomFlipX(null);
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
    
    setIsBottomView(true);
  }, [isBottomView, topImage, bottomImage, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setDrawingStrokes, canvasRef, setOriginalTopFlipX, setOriginalBottomFlipX, viewPan, viewScale, contentBorder]);

  // Switch to Top View (reset flip)
  const handleSwitchToTopView = useCallback(() => {
    if (!isBottomView) return; // Already in top view
    
    const center = getCenterPoint();
    const centerX = center.x;
    
    // Restore original flipX state (before bottom view transform was applied)
    if (topImage && originalTopFlipX !== null) {
      setTopImage(prev => prev ? { ...prev, flipX: originalTopFlipX } : null);
    }
    if (bottomImage && originalBottomFlipX !== null) {
      setBottomImage(prev => prev ? { ...prev, flipX: originalBottomFlipX } : null);
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
    
    setIsBottomView(false);
  }, [isBottomView, topImage, bottomImage, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setDrawingStrokes, canvasRef, originalTopFlipX, originalBottomFlipX, viewPan, viewScale, contentBorder]);

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
    
  }, [topImage, bottomImage, setTopImage, setBottomImage, setComponentsTop, setComponentsBottom, setDrawingStrokes, canvasRef, viewPan, viewScale, contentBorder]);

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
            Transform All
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
            onClick={handleSwitchToTopView}
            disabled={!isBottomView}
            style={buttonStyle(!isBottomView)}
            onMouseEnter={(e) => !isBottomView && (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => !isBottomView && (e.currentTarget.style.background = 'transparent')}
          >
            {!isBottomView ? '✓ ' : ''}Switch to Top View
          </button>
          <button
            onClick={handleSwitchToBottomView}
            disabled={isBottomView}
            style={buttonStyle(isBottomView)}
            onMouseEnter={(e) => isBottomView && (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => isBottomView && (e.currentTarget.style.background = 'transparent')}
          >
            {isBottomView ? '✓ ' : ''}Switch to Bottom View
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

