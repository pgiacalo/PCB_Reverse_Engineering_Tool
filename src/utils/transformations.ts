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

/**
 * Unified transformation mathematics library
 * 
 * This library provides consistent transformation functions used throughout
 * the application to ensure images, components, and other objects are transformed
 * identically, preventing misalignment issues.
 * 
 * This is the SINGLE SOURCE OF TRUTH for all mathematical operations in the application.
 * All math functions should be imported from this library, not used directly from Math.*
 */

// ============================================================================
// Mathematical Constants
// ============================================================================

/** Full circle in radians (2π) */
export const TWO_PI = Math.PI * 2;

/** Full circle in degrees */
export const FULL_CIRCLE_DEG = 360;

// ============================================================================
// Angle Utilities
// ============================================================================

/**
 * Normalize an angle in degrees to the range [0, 360)
 * @param angle Angle in degrees (can be negative or > 360)
 * @returns Normalized angle in range [0, 360)
 */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 * @param radians Angle in radians
 * @returns Angle in degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Add two angles and normalize the result
 * @param angle1 First angle in degrees
 * @param angle2 Second angle in degrees
 * @returns Sum of angles normalized to [0, 360)
 */
export function addAngles(angle1: number, angle2: number): number {
  return normalizeAngle(angle1 + angle2);
}

// ============================================================================
// Trigonometric Functions (wrappers for consistency)
// ============================================================================

/**
 * Calculate tangent of an angle in radians
 * @param radians Angle in radians
 * @returns Tangent value
 */
export function tan(radians: number): number {
  return Math.tan(radians);
}

/**
 * Calculate cosine of an angle in radians
 * @param radians Angle in radians
 * @returns Cosine value
 */
export function cos(radians: number): number {
  return Math.cos(radians);
}

/**
 * Calculate sine of an angle in radians
 * @param radians Angle in radians
 * @returns Sine value
 */
export function sin(radians: number): number {
  return Math.sin(radians);
}

/**
 * Calculate arctangent of y/x in radians
 * @param y Y component
 * @param x X component
 * @returns Angle in radians, range [-π, π]
 */
export function atan2(y: number, x: number): number {
  return Math.atan2(y, x);
}

/**
 * Calculate angle from a vector (dx, dy) in degrees
 * Uses atan2 to get angle in range [-180, 180], then normalizes to [0, 360)
 * @param dx X component of vector
 * @param dy Y component of vector
 * @returns Angle in degrees, normalized to [0, 360)
 */
export function angleFromVector(dx: number, dy: number): number {
  const angleRad = atan2(dy, dx);
  const angleDeg = radToDeg(angleRad);
  return normalizeAngle(angleDeg);
}

/**
 * Calculate angle from a vector (dx, dy) in degrees, returning raw atan2 result
 * @param dx X component of vector
 * @param dy Y component of vector
 * @returns Angle in degrees, range [-180, 180]
 */
export function angleFromVectorRaw(dx: number, dy: number): number {
  return radToDeg(atan2(dy, dx));
}

// ============================================================================
// Flip Axis Determination
// ============================================================================

/**
 * Determines which axis to flip when performing a horizontal flip in world coordinates,
 * based on the current rotation of the object.
 * 
 * When an object is rotated, its local axes are rotated relative to world axes.
 * To flip horizontally in world space, we need to flip along the axis that is
 * currently horizontal in world coordinates.
 * 
 * @param rotation Current rotation in degrees
 * @returns Object indicating which axis to flip ('x' or 'y')
 */
export function determineFlipAxis(rotation: number): 'x' | 'y' {
  const normalizedRotation = normalizeAngle(rotation);
  const tolerance = 1; // Tolerance for floating point comparisons (1 degree)

  // At 0° or 180°: local X is horizontal in world -> flipX
  if (
    (normalizedRotation >= 0 && normalizedRotation < tolerance) ||
    (normalizedRotation >= 180 - tolerance && normalizedRotation < 180 + tolerance) ||
    (normalizedRotation >= 360 - tolerance)
  ) {
    return 'x';
  }
  
  // At 90° or 270°: local Y is horizontal in world -> flipY
  if (
    (normalizedRotation >= 90 - tolerance && normalizedRotation < 90 + tolerance) ||
    (normalizedRotation >= 270 - tolerance && normalizedRotation < 270 + tolerance)
  ) {
    return 'y';
  }
  
  // For other rotations, determine which local axis is more horizontal in world coordinates
  const rad = degToRad(normalizedRotation);
  const cosR = cos(rad);
  const sinR = sin(rad);
  
  // Local X axis direction in world coordinates after rotation
  const localXWorldX = cosR;
  // Local Y axis direction in world coordinates after rotation (Y axis rotated 90° from X)
  const localYWorldX = -sinR;
  
  // Use the axis that is more horizontal (larger absolute X component in world)
  return Math.abs(localXWorldX) > Math.abs(localYWorldX) ? 'x' : 'y';
}

// ============================================================================
// Canvas Transformation Application
// ============================================================================

/**
 * Transformation parameters for applying to canvas context
 */
export interface TransformParams {
  /** X position in world coordinates */
  x: number;
  /** Y position in world coordinates */
  y: number;
  /** Rotation in degrees */
  rotation?: number;
  /** Scale factor (applied before flip) */
  scale?: number;
  /** Horizontal flip (mirror across vertical axis) */
  flipX?: boolean;
  /** Vertical flip (mirror across horizontal axis) */
  flipY?: boolean;
  /** Skew X angle in radians */
  skewX?: number;
  /** Skew Y angle in radians */
  skewY?: number;
}

/**
 * Apply transformations to a canvas context in the correct order.
 * 
 * Transformation order (applied right-to-left in canvas):
 * 1. Translate to position (x, y)
 * 2. Rotate by rotation angle
 * 3. Apply skew (if any)
 * 4. Scale (including flip via negative scale)
 * 
 * This order ensures that:
 * - Objects rotate around their center
 * - Flips occur in local coordinate space (after rotation)
 * - Scale is applied last (affects final size)
 * 
 * @param ctx Canvas rendering context
 * @param params Transformation parameters
 */
export function applyTransform(ctx: CanvasRenderingContext2D, params: TransformParams): void {
  const {
    x,
    y,
    rotation = 0,
    scale = 1,
    flipX = false,
    flipY = false,
    skewX = 0,
    skewY = 0,
  } = params;

  // 1. Translate to position
  ctx.translate(x, y);

  // 2. Rotate
  if (rotation !== 0) {
    ctx.rotate(degToRad(rotation));
  }

  // 3. Apply skew (keystone) if any
  if (skewX !== 0 || skewY !== 0) {
    const sx = tan(skewX);
    const sy = tan(skewY);
    ctx.transform(1, sy, sx, 1, 0, 0);
  }

  // 4. Scale (including flip via negative scale)
  const scaleX = scale * (flipX ? -1 : 1);
  const scaleY = scale * (flipY ? -1 : 1);
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }
}

/**
 * Apply a simplified transform (position, rotation, flip) without scale or skew.
 * Useful for components and symbols that don't have scale or skew.
 * 
 * @param ctx Canvas rendering context
 * @param x X position in world coordinates
 * @param y Y position in world coordinates
 * @param rotation Rotation in degrees (default: 0)
 * @param flipX Horizontal flip (default: false)
 * @param flipY Vertical flip (default: false)
 */
export function applySimpleTransform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number = 0,
  flipX: boolean = false,
  flipY: boolean = false
): void {
  applyTransform(ctx, { x, y, rotation, flipX, flipY });
}

// ============================================================================
// Perspective Change Helpers
// ============================================================================

/**
 * Calculate the new flip state when toggling horizontal flip in world coordinates.
 * Takes into account the current rotation to determine which local axis to flip.
 * 
 * @param currentFlipX Current flipX state
 * @param currentFlipY Current flipY state
 * @param rotation Current rotation in degrees
 * @returns New flip state { flipX, flipY }
 */
export function toggleHorizontalFlip(
  currentFlipX: boolean,
  currentFlipY: boolean,
  rotation: number
): { flipX: boolean; flipY: boolean } {
  const axis = determineFlipAxis(rotation);
  
  if (axis === 'x') {
    return { flipX: !currentFlipX, flipY: currentFlipY };
  } else {
    return { flipX: currentFlipX, flipY: !currentFlipY };
  }
}

/**
 * Calculate the new orientation when rotating by a given angle.
 * 
 * @param currentOrientation Current orientation in degrees
 * @param rotationDelta Angle to add in degrees (can be negative)
 * @returns New orientation normalized to [0, 360)
 */
export function rotateOrientation(currentOrientation: number, rotationDelta: number): number {
  const current = currentOrientation ?? 0;
  return addAngles(current, rotationDelta);
}

/**
 * Calculate the new orientation when flipping horizontally.
 * This inverts the orientation (180° - orientation) to maintain visual consistency.
 * 
 * @param currentOrientation Current orientation in degrees
 * @returns New orientation after horizontal flip
 */
export function flipOrientationHorizontally(currentOrientation: number): number {
  const current = currentOrientation ?? 0;
  return normalizeAngle(360 - current);
}

// ============================================================================
// Point Transformations (for coordinate calculations, if needed in future)
// ============================================================================

/**
 * Rotate a point around the origin
 * @param x X coordinate
 * @param y Y coordinate
 * @param angleDeg Rotation angle in degrees
 * @returns Rotated point { x, y }
 */
export function rotatePoint(x: number, y: number, angleDeg: number): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  const cosVal = cos(rad);
  const sinVal = sin(rad);
  return {
    x: x * cosVal - y * sinVal,
    y: x * sinVal + y * cosVal,
  };
}

/**
 * Rotate a point around a center point
 * @param x X coordinate of point to rotate
 * @param y Y coordinate of point to rotate
 * @param centerX X coordinate of rotation center
 * @param centerY Y coordinate of rotation center
 * @param angleDeg Rotation angle in degrees
 * @returns Rotated point { x, y }
 */
export function rotatePointAround(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  angleDeg: number
): { x: number; y: number } {
  const dx = x - centerX;
  const dy = y - centerY;
  const rotated = rotatePoint(dx, dy, angleDeg);
  return {
    x: centerX + rotated.x,
    y: centerY + rotated.y,
  };
}

// ============================================================================
// View/Camera Transformations
// ============================================================================

/**
 * Apply view-level transformations (rotation and flip) to canvas context.
 * These transformations affect the entire view/camera, not individual objects.
 * 
 * View transforms are applied BEFORE object transforms, so they affect everything
 * uniformly. This ensures all objects maintain their relative positions.
 * 
 * The flip is performed around the vertical axis of the canvas (camera center),
 * which ensures the perspective change doesn't affect world coordinates.
 * 
 * @param ctx Canvas rendering context
 * @param rotation View rotation in degrees (default: 0)
 * @param flipX View horizontal flip (default: false)
 */
export function applyViewTransform(
  ctx: CanvasRenderingContext2D,
  rotation: number = 0,
  flipX: boolean = false
): void {
  // Apply view flip FIRST - flip horizontally around the vertical axis of the canvas
  // This must happen before rotation to ensure flip occurs around canvas vertical axis,
  // not the rotated coordinate system's axis
  // At this point in the transformation chain, the origin (0,0) is at the camera center
  // in world coordinates, so we can flip around the origin to flip around the vertical axis
  if (flipX) {
    // Flip around vertical axis (scale -1 on X)
    // This flips around the origin, which is at the camera center after pan/scale
    ctx.scale(-1, 1);
  }
  
  // Apply view rotation AFTER flip
  // This ensures the flip always occurs around the canvas vertical axis, regardless of rotation
  if (rotation !== 0) {
    ctx.rotate(degToRad(rotation));
  }
}

/**
 * Apply the inverse of view-level transformations to keep objects upright.
 * This undoes the view rotation and flip so that objects appear
 * in their original orientation relative to the canvas.
 * 
 * Since applyViewTransform does: flip first, then rotate,
 * and canvas applies transforms in reverse order (last called = first applied),
 * the actual effect is: rotate first, then flip.
 * 
 * To undo this, we must undo in the same order as the effect:
 * 1. Undo flip first (apply flip again, since scale(-1,1) applied twice = identity)
 * 2. Then undo rotation (rotate by negative angle)
 * 
 * Special case: When both flip and ±90° rotation are present, the combination
 * results in a net vertical flip, so we need an additional 180° rotation to keep
 * indicators upright.
 * 
 * @param ctx Canvas rendering context
 * @param rotation View rotation in degrees (to be undone)
 * @param flipX View horizontal flip (to be undone)
 */
export function applyInverseViewTransform(
  ctx: CanvasRenderingContext2D,
  rotation: number = 0,
  flipX: boolean = false
): void {
  // Check if we have both flip and ±90° rotation (special case)
  // When flip + 90° rotation are combined, the net effect is a vertical flip
  // which requires an additional 180° rotation to keep indicators upright
  const normalizedRotation = normalizeAngle(rotation);
  const is90Rotation = normalizedRotation === 90 || normalizedRotation === 270;
  
  // Always undo in the same order: flip first, then rotation
  if (flipX) {
    ctx.scale(-1, 1);
  }
  if (rotation !== 0) {
    ctx.rotate(degToRad(-rotation));
  }
  
  // Special case: if both flip and ±90° rotation are present, add 180° to correct
  if (flipX && is90Rotation) {
    ctx.rotate(degToRad(180));
  }
}

/**
 * Convert a canvas coordinate delta to world coordinate delta
 * Accounts for view rotation and flip so that mouse movement direction
 * matches world coordinate movement direction
 * 
 * @param canvasDeltaX Canvas coordinate delta X
 * @param canvasDeltaY Canvas coordinate delta Y
 * @param viewScale View scale factor
 * @param viewRotation View rotation in degrees
 * @param viewFlipX Whether view is flipped horizontally
 * @returns World coordinate delta { x, y }
 */
export function canvasDeltaToWorldDelta(
  canvasDeltaX: number,
  canvasDeltaY: number,
  viewScale: number,
  viewRotation: number = 0,
  viewFlipX: boolean = false
): { x: number; y: number } {
  // First, undo the scaling
  let worldX = canvasDeltaX / viewScale;
  let worldY = canvasDeltaY / viewScale;
  
  // Then, undo the rotation (rotate by negative angle)
  if (viewRotation !== 0) {
    const rotated = rotatePoint(worldX, worldY, -viewRotation);
    worldX = rotated.x;
    worldY = rotated.y;
  }
  
  // Finally, undo the flip (if flipped, X is negated)
  if (viewFlipX) {
    worldX = -worldX;
  }
  
  return { x: worldX, y: worldY };
}

/**
 * Convert content canvas coordinates to world coordinates
 * Accounts for view pan, scale, rotation, and flip
 * 
 * The view transform is applied in this order (in code):
 * 1. translate(viewPan.x, viewPan.y)
 * 2. scale(viewScale, viewScale)
 * 3. applyViewTransform(ctx, viewRotation, viewFlipX) which does:
 *    - if flipX: ctx.scale(-1, 1)
 *    - if rotation: ctx.rotate(degToRad(rotation))
 * 
 * Canvas applies transforms in reverse order (last called = first applied), so the actual effect is:
 * 1. First: rotate(rotation)
 * 2. Then: scale(-1, 1) if flipX
 * 3. Then: scale(viewScale, viewScale)
 * 4. Then: translate(viewPan.x, viewPan.y)
 * 
 * To convert from content canvas coordinates to world coordinates, we undo in reverse order:
 * 1. Undo translate: subtract viewPan
 * 2. Undo scale: divide by viewScale
 * 3. Undo flip: if flipX, negate X
 * 4. Undo rotation: rotate by -viewRotation
 * 
 * @param contentCanvasX X coordinate in content canvas space (after CONTENT_BORDER)
 * @param contentCanvasY Y coordinate in content canvas space (after CONTENT_BORDER)
 * @param viewPan View pan offset in content canvas coordinates
 * @param viewScale View scale factor
 * @param viewRotation View rotation in degrees
 * @param viewFlipX Whether view is flipped horizontally
 * @returns World coordinates { x, y }
 */
export function contentCanvasToWorld(
  contentCanvasX: number,
  contentCanvasY: number,
  viewPan: { x: number; y: number },
  viewScale: number,
  viewRotation: number = 0,
  viewFlipX: boolean = false
): { x: number; y: number } {
  // Step 1: Undo translate (subtract viewPan)
  let x = contentCanvasX - viewPan.x;
  let y = contentCanvasY - viewPan.y;
  
  // Step 2: Undo scale (divide by viewScale)
  x = x / viewScale;
  y = y / viewScale;
  
  // Step 3: Undo flip (if flipped, X is negated)
  if (viewFlipX) {
    x = -x;
  }
  
  // Step 4: Undo rotation (rotate by negative angle)
  if (viewRotation !== 0) {
    const rotated = rotatePoint(x, y, -viewRotation);
    x = rotated.x;
    y = rotated.y;
  }
  
  return { x, y };
}

/**
 * Darken a color by reducing its brightness
 * @param color - Color in hex format (e.g., '#E69F00' or 'rgb(230, 159, 0)')
 * @param factor - Darkening factor (0-1), where 0.5 means 50% darker. Default is 0.4 (40% darker)
 * @returns Darkened color in the same format as input
 */
export function darkenColor(color: string, factor: number = 0.4): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    const darkenedR = Math.max(0, Math.floor(r * (1 - factor)));
    const darkenedG = Math.max(0, Math.floor(g * (1 - factor)));
    const darkenedB = Math.max(0, Math.floor(b * (1 - factor)));
    
    return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
  }
  
  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const alpha = rgbMatch[4] ? rgbMatch[4].trim() : '';
    
    const darkenedR = Math.max(0, Math.floor(r * (1 - factor)));
    const darkenedG = Math.max(0, Math.floor(g * (1 - factor)));
    const darkenedB = Math.max(0, Math.floor(b * (1 - factor)));
    
    if (color.includes('rgba')) {
      return `rgba(${darkenedR}, ${darkenedG}, ${darkenedB}${alpha ? `, ${alpha}` : ', 1'})`;
    } else {
      return `rgb(${darkenedR}, ${darkenedG}, ${darkenedB})`;
    }
  }
  
  // If we can't parse it, return original color
  return color;
}

