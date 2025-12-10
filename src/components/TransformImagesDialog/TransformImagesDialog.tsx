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
import type { Tool } from '../../hooks/useToolRegistry';

export interface TransformImagesDialogProps {
  visible: boolean;
  onClose: () => void;
  
  // Image state
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  selectedImageForTransform: 'top' | 'bottom' | 'both' | null;
  setSelectedImageForTransform: (image: 'top' | 'bottom' | 'both' | null) => void;
  
  // Transform operations
  transformMode: 'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone';
  setTransformMode: (mode: 'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone') => void;
  updateImageTransform: (type: 'top' | 'bottom' | 'both', updates: Partial<PCBImage>) => void;
  resetImageTransform: () => void;
  setCurrentTool: (tool: Tool) => void;
  
  // Image filters
  isGrayscale: boolean;
  setIsGrayscale: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Lock state
  areImagesLocked: boolean;
}

export const TransformImagesDialog: React.FC<TransformImagesDialogProps> = ({
  visible,
  onClose,
  topImage,
  bottomImage,
  selectedImageForTransform,
  setSelectedImageForTransform,
  transformMode,
  setTransformMode,
  updateImageTransform,
  resetImageTransform,
  setCurrentTool,
  isGrayscale,
  setIsGrayscale,
  areImagesLocked,
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
      const dialogHeight = dialogRef.current?.offsetHeight || 600;
      
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

  if (!visible) return null;

  const hasTopImage = topImage !== null;
  const hasBottomImage = bottomImage !== null;
  const hasAnyImage = hasTopImage || hasBottomImage;
  const hasBothImages = hasTopImage && hasBottomImage;
  
  // Determine which image selection to use for operations
  const effectiveSelection = selectedImageForTransform || (hasTopImage ? 'top' : hasBottomImage ? 'bottom' : null);
  
  // Get current brightness/contrast values based on selection
  const getCurrentBrightness = () => {
    if (effectiveSelection === 'top' && topImage) return topImage.brightness ?? 100;
    if (effectiveSelection === 'bottom' && bottomImage) return bottomImage.brightness ?? 100;
    if (effectiveSelection === 'both' && topImage) return topImage.brightness ?? 100;
    return 100;
  };
  
  const getCurrentContrast = () => {
    if (effectiveSelection === 'top' && topImage) return topImage.contrast ?? 100;
    if (effectiveSelection === 'bottom' && bottomImage) return bottomImage.contrast ?? 100;
    if (effectiveSelection === 'both' && topImage) return topImage.contrast ?? 100;
    return 100;
  };

  const currentBrightness = getCurrentBrightness();
  const currentContrast = getCurrentContrast();
  
  const isDisabled = !hasAnyImage || areImagesLocked;

  // Handle flip operations
  const handleHorizontalFlip = () => {
    if (!effectiveSelection || isDisabled) return;
    
    if (effectiveSelection === 'both') {
      const newFlipX = !(topImage?.flipX || false);
      updateImageTransform('both', { flipX: newFlipX });
    } else {
      const currentFlipX = effectiveSelection === 'top' ? (topImage?.flipX || false) : (bottomImage?.flipX || false);
      updateImageTransform(effectiveSelection, { flipX: !currentFlipX });
    }
  };

  const handleVerticalFlip = () => {
    if (!effectiveSelection || isDisabled) return;
    
    if (effectiveSelection === 'both') {
      const newFlipY = !(topImage?.flipY || false);
      updateImageTransform('both', { flipY: newFlipY });
    } else {
      const currentFlipY = effectiveSelection === 'top' ? (topImage?.flipY || false) : (bottomImage?.flipY || false);
      updateImageTransform(effectiveSelection, { flipY: !currentFlipY });
    }
  };

  // Handle mode selection
  const handleModeSelect = (mode: 'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone') => {
    if (isDisabled) return;
    if (effectiveSelection) {
      setSelectedImageForTransform(effectiveSelection);
    }
    setTransformMode(mode);
    setCurrentTool('transform');
  };

  // Handle brightness/contrast changes
  const handleBrightnessChange = (value: number) => {
    if (!effectiveSelection || isDisabled) return;
    updateImageTransform(effectiveSelection, { brightness: value });
  };

  const handleContrastChange = (value: number) => {
    if (!effectiveSelection || isDisabled) return;
    updateImageTransform(effectiveSelection, { contrast: value });
  };

  // Handle grayscale toggle
  const handleGrayscaleToggle = () => {
    if (isDisabled) return;
    if (effectiveSelection) {
      setSelectedImageForTransform(effectiveSelection);
    }
    setCurrentTool('transform');
    setIsGrayscale(!isGrayscale);
  };

  // Handle reset transform
  const handleResetTransform = () => {
    if (isDisabled) return;
    setCurrentTool('transform');
    resetImageTransform();
  };

  // Common button style
  const buttonStyle = (disabled: boolean, isActive: boolean = false): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    color: disabled ? '#666' : '#f2f2f2',
    background: isActive ? '#3a3a42' : 'transparent',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    transition: 'background 0.15s',
  });

  // Radio button style
  const radioLabelStyle = (disabled: boolean, isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    color: disabled ? '#666' : '#f2f2f2',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    background: isSelected ? '#3a3a42' : 'transparent',
    borderRadius: 4,
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
            Transform Images
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
        {/* Image Selection */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
            Apply to:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={radioLabelStyle(!hasTopImage, effectiveSelection === 'top')}>
              <input
                type="radio"
                name="imageSelection"
                checked={effectiveSelection === 'top'}
                onChange={() => setSelectedImageForTransform('top')}
                disabled={!hasTopImage}
                style={{ accentColor: '#6b9fff' }}
              />
              Top Image
              {!hasTopImage && <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>(not loaded)</span>}
            </label>
            <label style={radioLabelStyle(!hasBottomImage, effectiveSelection === 'bottom')}>
              <input
                type="radio"
                name="imageSelection"
                checked={effectiveSelection === 'bottom'}
                onChange={() => setSelectedImageForTransform('bottom')}
                disabled={!hasBottomImage}
                style={{ accentColor: '#6b9fff' }}
              />
              Bottom Image
              {!hasBottomImage && <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>(not loaded)</span>}
            </label>
            <label style={radioLabelStyle(!hasBothImages, effectiveSelection === 'both')}>
              <input
                type="radio"
                name="imageSelection"
                checked={effectiveSelection === 'both'}
                onChange={() => setSelectedImageForTransform('both')}
                disabled={!hasBothImages}
                style={{ accentColor: '#6b9fff' }}
              />
              Both Images
              {!hasBothImages && <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>(need both)</span>}
            </label>
          </div>
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

        {/* Flip Operations */}
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={handleHorizontalFlip}
            disabled={isDisabled}
            style={buttonStyle(isDisabled)}
            onMouseEnter={(e) => !isDisabled && (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Horizontal Flip
          </button>
          <button
            onClick={handleVerticalFlip}
            disabled={isDisabled}
            style={buttonStyle(isDisabled)}
            onMouseEnter={(e) => !isDisabled && (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Vertical Flip
          </button>
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

        {/* Transform Modes */}
        <div style={{ marginBottom: '12px' }}>
          {(['nudge', 'scale', 'rotate', 'slant', 'keystone'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeSelect(mode)}
              disabled={isDisabled}
              style={buttonStyle(isDisabled, transformMode === mode)}
              onMouseEnter={(e) => !isDisabled && transformMode !== mode && (e.currentTarget.style.background = '#3a3a42')}
              onMouseLeave={(e) => transformMode !== mode && (e.currentTarget.style.background = 'transparent')}
            >
              {transformMode === mode ? '✓ ' : ''}Mode: {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

        {/* Brightness Control */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ color: '#f2f2f2', fontSize: '13px', fontWeight: 500 }}>Brightness</label>
            <span style={{ color: '#888', fontSize: '12px', minWidth: '45px', textAlign: 'right' }}>
              {currentBrightness}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={currentBrightness}
            onChange={(e) => handleBrightnessChange(parseInt(e.target.value, 10))}
            disabled={isDisabled}
            style={{
              width: '100%',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              accentColor: '#6b9fff',
            }}
          />
        </div>

        {/* Contrast Control */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ color: '#f2f2f2', fontSize: '13px', fontWeight: 500 }}>Contrast</label>
            <span style={{ color: '#888', fontSize: '12px', minWidth: '45px', textAlign: 'right' }}>
              {currentContrast}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={currentContrast}
            onChange={(e) => handleContrastChange(parseInt(e.target.value, 10))}
            disabled={isDisabled}
            style={{
              width: '100%',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              accentColor: '#6b9fff',
            }}
          />
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

        {/* Color Modes */}
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={handleGrayscaleToggle}
            disabled={isDisabled}
            style={buttonStyle(isDisabled, isGrayscale)}
            onMouseEnter={(e) => !isDisabled && !isGrayscale && (e.currentTarget.style.background = '#3a3a42')}
            onMouseLeave={(e) => !isGrayscale && (e.currentTarget.style.background = 'transparent')}
          >
            {isGrayscale ? '✓ ' : ''}Grayscale Mode
          </button>
        </div>

        <div style={{ height: 1, background: '#444', margin: '16px 0' }} />

        {/* Reset and Close buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={handleResetTransform}
            disabled={isDisabled}
            style={{
              padding: '8px 16px',
              background: isDisabled ? '#444' : '#555',
              color: isDisabled ? '#777' : '#f2f2f2',
              border: '1px solid #666',
              borderRadius: 6,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Reset Transform
          </button>
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

        {/* Locked warning */}
        {areImagesLocked && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#3d2b2b',
            border: '1px solid #5a3a3a',
            borderRadius: 4,
            fontSize: '12px',
            color: '#e88',
          }}>
            ⚠️ Images are locked. Unlock via Images → Lock Images to make changes.
          </div>
        )}
      </div>
    </div>
  );
};

export default TransformImagesDialog;
