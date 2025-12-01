// ============================================================================
// Custom Cursor Generation Utilities
// ============================================================================

import type { Tool } from '../types';

/**
 * Generate a custom cursor for the select tool
 */
export function generateSelectCursor(): string {
  return 'crosshair';
}

/**
 * Generate a custom cursor for drawing tools (trace/via)
 * Shows a circle with the current brush size and color
 */
export function generateDrawCursor(size: number, color: string): string {
  const canvas = document.createElement('canvas');
  const radius = Math.max(4, Math.min(size / 2, 32));
  canvas.width = radius * 2 + 2;
  canvas.height = radius * 2 + 2;
  
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(radius + 1, radius + 1, radius, 0, Math.PI * 2);
  ctx.stroke();
  
  const dataUrl = canvas.toDataURL();
  return `url(${dataUrl}) ${radius + 1} ${radius + 1}, crosshair`;
}

/**
 * Generate a custom cursor for the eraser tool
 * Shows a square with the current brush size
 */
export function generateEraserCursor(size: number): string {
  const canvas = document.createElement('canvas');
  const halfSize = Math.max(4, Math.min(size / 2, 32));
  canvas.width = halfSize * 2 + 2;
  canvas.height = halfSize * 2 + 2;
  
  const ctx = canvas.getContext('2d')!;
  
  // Draw tilted pink eraser
  ctx.save();
  ctx.translate(halfSize + 1, halfSize + 1);
  ctx.rotate(-Math.PI / 6); // 30 degrees tilt
  
  // Pink eraser body
  ctx.fillStyle = '#FFB6C1';
  ctx.fillRect(-halfSize * 0.6, -halfSize * 0.4, halfSize * 1.2, halfSize * 0.8);
  
  // Darker outline
  ctx.strokeStyle = '#FF69B4';
  ctx.lineWidth = 1;
  ctx.strokeRect(-halfSize * 0.6, -halfSize * 0.4, halfSize * 1.2, halfSize * 0.8);
  
  ctx.restore();
  
  const dataUrl = canvas.toDataURL();
  return `url(${dataUrl}) ${halfSize + 1} ${halfSize + 1}, crosshair`;
}

/**
 * Generate a custom cursor for the magnify tool
 * Shows a magnifying glass with + or - sign
 */
export function generateMagnifyCursor(isZoomOut: boolean): string {
  const canvas = document.createElement('canvas');
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 2;
  
  // Draw magnifying glass circle
  const centerX = size / 2 - 2;
  const centerY = size / 2 - 2;
  const radius = 7;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Draw handle
  ctx.beginPath();
  ctx.moveTo(centerX + radius * 0.7, centerY + radius * 0.7);
  ctx.lineTo(centerX + radius * 1.5, centerY + radius * 1.5);
  ctx.stroke();
  
  // Draw + or - sign
  ctx.strokeStyle = isZoomOut ? '#f00' : '#0f0';
  ctx.lineWidth = 2;
  
  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(centerX - 4, centerY);
  ctx.lineTo(centerX + 4, centerY);
  ctx.stroke();
  
  // Vertical line (only for +)
  if (!isZoomOut) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 4);
    ctx.lineTo(centerX, centerY + 4);
    ctx.stroke();
  }
  
  const dataUrl = canvas.toDataURL();
  return `url(${dataUrl}) ${centerX} ${centerY}, zoom-in`;
}

/**
 * Generate a custom cursor for the hand/pan tool
 */
export function generateHandCursor(isGrabbing: boolean): string {
  return isGrabbing ? 'grabbing' : 'grab';
}

/**
 * Generate a custom cursor for the component tool
 * Shows a chip icon with the current color
 */
export function generateComponentCursor(color: string): string {
  const canvas = document.createElement('canvas');
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  
  // Draw chip body
  const chipWidth = 16;
  const chipHeight = 12;
  const chipX = (size - chipWidth) / 2;
  const chipY = (size - chipHeight) / 2;
  
  ctx.strokeRect(chipX, chipY, chipWidth, chipHeight);
  
  // Draw pins (3 on each side)
  const pinLength = 3;
  const pinSpacing = 4;
  
  for (let i = 0; i < 3; i++) {
    const y = chipY + 2 + i * pinSpacing;
    // Left pins
    ctx.beginPath();
    ctx.moveTo(chipX, y);
    ctx.lineTo(chipX - pinLength, y);
    ctx.stroke();
    // Right pins
    ctx.beginPath();
    ctx.moveTo(chipX + chipWidth, y);
    ctx.lineTo(chipX + chipWidth + pinLength, y);
    ctx.stroke();
  }
  
  // Draw notch (pin 1 indicator)
  ctx.beginPath();
  ctx.arc(chipX + chipWidth / 2, chipY, 2, 0, Math.PI, true);
  ctx.stroke();
  
  const dataUrl = canvas.toDataURL();
  return `url(${dataUrl}) ${size / 2} ${size / 2}, crosshair`;
}

/**
 * Generate a custom cursor for the ground tool
 * Shows a ground symbol with the current color
 */
export function generateGroundCursor(color: string, size: number): string {
  const canvas = document.createElement('canvas');
  const unit = Math.max(12, Math.min(size, 32));
  const vLen = unit * 0.9;
  const barG = unit * 0.24;
  const width = unit * 1.6;
  
  canvas.width = width + 4;
  canvas.height = vLen + barG * 2 + 4;
  
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  const centerX = canvas.width / 2;
  const startY = 2;
  
  // Vertical line
  ctx.beginPath();
  ctx.moveTo(centerX, startY);
  ctx.lineTo(centerX, startY + vLen);
  ctx.stroke();
  
  // Horizontal bars
  for (let i = 0; i < 3; i++) {
    const barY = startY + vLen + i * barG;
    const barWidth = width * (1 - i * 0.25);
    ctx.beginPath();
    ctx.moveTo(centerX - barWidth / 2, barY);
    ctx.lineTo(centerX + barWidth / 2, barY);
    ctx.stroke();
  }
  
  const dataUrl = canvas.toDataURL();
  return `url(${dataUrl}) ${centerX} ${startY}, crosshair`;
}

/**
 * Generate a bold X crosshairs cursor for the center tool
 */
export function generateCenterCursor(): string {
  const canvas = document.createElement('canvas');
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  const center = size / 2;
  const length = 8;
  
  // Draw bold X crosshairs
  ctx.beginPath();
  // Vertical line (top)
  ctx.moveTo(center, center - length);
  ctx.lineTo(center, center - 2);
  // Vertical line (bottom)
  ctx.moveTo(center, center + 2);
  ctx.lineTo(center, center + length);
  // Horizontal line (left)
  ctx.moveTo(center - length, center);
  ctx.lineTo(center - 2, center);
  // Horizontal line (right)
  ctx.moveTo(center + 2, center);
  ctx.lineTo(center + length, center);
  ctx.stroke();
  
  const dataUrl = canvas.toDataURL();
  return `url(${dataUrl}) ${center} ${center}, crosshair`;
}

/**
 * Get the appropriate cursor for the current tool and state
 */
export function getCursorForTool(
  tool: Tool,
  brushSize: number,
  brushColor: string,
  isShiftPressed: boolean = false,
  isMouseDown: boolean = false
): string {
  switch (tool) {
    case 'select':
      return generateSelectCursor();
    
    case 'draw':
      return generateDrawCursor(brushSize, brushColor);
    
    case 'erase':
      return generateEraserCursor(brushSize);
    
    case 'magnify':
      return generateMagnifyCursor(isShiftPressed);
    
    case 'pan':
      return generateHandCursor(isMouseDown);
    
    case 'component':
      return generateComponentCursor(brushColor);
    
    case 'ground':
      return generateGroundCursor(brushColor, brushSize);
    
    case 'center':
      return generateCenterCursor();
    
    case 'transform':
      return 'move';
    
    default:
      return 'default';
  }
}

