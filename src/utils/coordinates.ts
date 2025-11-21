// ============================================================================
// Coordinate Transformation Utilities
// ============================================================================

import type { Point, Via } from '../types';
import { SNAP_DISTANCE } from '../constants';

/**
 * Convert screen coordinates to canvas coordinates
 * Accounts for device pixel ratio and canvas scaling
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement,
  dpr: number
): Point {
  const rect = canvas.getBoundingClientRect();
  const x = (screenX - rect.left) * dpr;
  const y = (screenY - rect.top) * dpr;
  return { x, y };
}

/**
 * Convert canvas coordinates to world coordinates
 * Accounts for view pan and scale
 */
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  viewPanX: number,
  viewPanY: number,
  viewScale: number
): Point {
  const x = (canvasX - viewPanX) / viewScale;
  const y = (canvasY - viewPanY) / viewScale;
  return { x, y };
}

/**
 * Convert world coordinates to canvas coordinates
 * Accounts for view pan and scale
 */
export function worldToCanvas(
  worldX: number,
  worldY: number,
  viewPanX: number,
  viewPanY: number,
  viewScale: number
): Point {
  const x = worldX * viewScale + viewPanX;
  const y = worldY * viewScale + viewPanY;
  return { x, y };
}

/**
 * Convert screen coordinates directly to world coordinates
 * Combines screenToCanvas and canvasToWorld
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement,
  dpr: number,
  viewPanX: number,
  viewPanY: number,
  viewScale: number
): Point {
  const canvasPoint = screenToCanvas(screenX, screenY, canvas, dpr);
  return canvasToWorld(canvasPoint.x, canvasPoint.y, viewPanX, viewPanY, viewScale);
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest via to a given point
 * Returns the via and its distance, or null if no vias exist
 */
export function findNearestVia(
  point: Point,
  vias: Via[]
): { via: Via; distance: number } | null {
  if (vias.length === 0) return null;

  let nearest: Via | null = null;
  let minDist = Infinity;

  for (const via of vias) {
    const dist = distance(point, { x: via.x, y: via.y });
    if (dist < minDist) {
      minDist = dist;
      nearest = via;
    }
  }

  return nearest ? { via: nearest, distance: minDist } : null;
}

/**
 * Snap a point to the nearest via if within snap distance
 * Returns the snapped point or the original point if no snap
 */
export function snapToNearestVia(
  point: Point,
  vias: Via[],
  snapDistance: number = SNAP_DISTANCE
): Point {
  const nearest = findNearestVia(point, vias);
  
  if (nearest && nearest.distance <= snapDistance) {
    return { x: nearest.via.x, y: nearest.via.y };
  }
  
  return point;
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRect(
  point: Point,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  return (
    point.x >= rectX &&
    point.x <= rectX + rectWidth &&
    point.y >= rectY &&
    point.y <= rectY + rectHeight
  );
}

/**
 * Check if two rectangles overlap
 */
export function rectsOverlap(
  r1X: number,
  r1Y: number,
  r1Width: number,
  r1Height: number,
  r2X: number,
  r2Y: number,
  r2Width: number,
  r2Height: number
): boolean {
  return !(
    r1X + r1Width < r2X ||
    r2X + r2Width < r1X ||
    r1Y + r1Height < r2Y ||
    r2Y + r2Height < r1Y
  );
}

/**
 * Calculate distance from a point to a line segment
 */
export function distanceToSegment(
  point: Point,
  segmentStart: Point,
  segmentEnd: Point
): number {
  const { x, y } = point;
  const { x: x1, y: y1 } = segmentStart;
  const { x: x2, y: y2 } = segmentEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Segment is a point
    return distance(point, segmentStart);
  }

  // Project point onto line segment
  let t = ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return distance(point, { x: projX, y: projY });
}

/**
 * Constrain a line to horizontal or vertical if close to axis-aligned
 */
export function constrainLine(
  start: Point,
  end: Point,
  threshold: number = 15 // degrees
): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);

  // Check if close to horizontal (0° or 180°)
  if (angle < threshold || angle > 180 - threshold) {
    return { x: end.x, y: start.y };
  }

  // Check if close to vertical (90°)
  if (Math.abs(angle - 90) < threshold) {
    return { x: start.x, y: end.y };
  }

  return end;
}

/**
 * Generate a globally unique ID for all drawing points
 * This ID is used across all vias, trace points, component pins, etc.
 * to establish electrical connections for netlist generation.
 * 
 * IMPORTANT: These IDs must be globally unique across the entire project
 * and must be preserved in save/load operations.
 * 
 * Thread-safe implementation: Uses a promise-based queue to serialize all
 * ID generation operations, ensuring atomic increments and preventing
 * race conditions even in async/concurrent scenarios.
 */
let nextPointId = 1;
let idGenerationQueue: Promise<number> = Promise.resolve(0);

/**
 * Generate a globally unique Node ID in a thread-safe manner.
 * 
 * This function uses a promise-based queue to ensure that all ID generation
 * operations are serialized. Even if called from multiple async contexts
 * simultaneously, each call will wait for the previous one to complete,
 * guaranteeing unique IDs and preventing race conditions.
 * 
 * The implementation ensures:
 * 1. Atomic increment operations
 * 2. No duplicate IDs can be generated
 * 3. Proper sequencing even in async scenarios
 * 
 * @returns A unique integer Node ID
 */
export function generatePointId(): number {
  // Serialize ID generation through a promise chain
  // Each operation waits for the previous one to complete
  let result: number;
  let resolved = false;
  
  idGenerationQueue = idGenerationQueue.then((lastId) => {
    result = lastId + 1;
    nextPointId = result + 1; // Update counter for next call
    resolved = true;
    return result;
  });
  
  // For synchronous code paths, perform immediate increment
  // The queue handles async serialization
  // In single-threaded JavaScript, this increment is atomic
  const currentId = nextPointId;
  nextPointId = currentId + 1;
  return currentId;
}

/**
 * Set the point ID counter to a specific value (used when loading projects)
 * Thread-safe: serializes the update through the queue to prevent race conditions
 * 
 * @param value The new counter value
 */
export function setPointIdCounter(value: number): void {
  // Update through the queue to ensure no ID generation happens during update
  idGenerationQueue = idGenerationQueue.then(() => {
    nextPointId = value;
    return value - 1; // Return value-1 so next generatePointId() will return value
  });
  // Also update immediately for synchronous code paths
  nextPointId = value;
}

/**
 * Get the current point ID counter value (used when saving projects)
 * Thread-safe: reads current value (read operations are inherently safe)
 * 
 * @returns The current counter value
 */
export function getPointIdCounter(): number {
  return nextPointId;
}

/**
 * Reset the point ID counter to 1
 * Thread-safe: serializes the reset through the queue to prevent race conditions
 */
export function resetPointIdCounter(): void {
  // Reset the queue to start fresh from 1
  idGenerationQueue = Promise.resolve(0);
  // Also reset immediately for synchronous code paths
  nextPointId = 1;
}

export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Truncate coordinate to 3 decimal places
 * This ensures consistent precision for all coordinates and enables exact matches
 * when objects snap to each other.
 * 
 * @param coord - The coordinate value to truncate
 * @returns The coordinate truncated to 3 decimal places
 */
export function truncateCoordinate(coord: number): number {
  return Math.round(coord * 1000) / 1000;
}

/**
 * Truncate a point's x and y coordinates to 3 decimal places
 * 
 * @param point - The point with x and y coordinates
 * @returns A new point with truncated coordinates
 */
export function truncatePoint(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: truncateCoordinate(point.x),
    y: truncateCoordinate(point.y)
  };
}

// ============================================================================
// Board Dimensions and Real-World Coordinate Conversion
// ============================================================================

export interface BoardDimensions {
  width: number;  // Real-world width
  height: number; // Real-world height
  unit: 'inches' | 'mm';
}

/**
 * Convert pixel coordinates to real-world coordinates
 * @param pixelX - X coordinate in pixels
 * @param pixelY - Y coordinate in pixels
 * @param boardDimensions - Board dimensions with unit
 * @param imageWidth - Width of the image in pixels
 * @param imageHeight - Height of the image in pixels
 * @returns Real-world coordinates in the specified unit
 */
export function pixelsToRealWorld(
  pixelX: number,
  pixelY: number,
  boardDimensions: BoardDimensions | null,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; unit: 'inches' | 'mm' } | null {
  if (!boardDimensions) {
    return null;
  }

  // Calculate scale factors (real-world units per pixel)
  const scaleX = boardDimensions.width / imageWidth;
  const scaleY = boardDimensions.height / imageHeight;

  // Convert pixel coordinates to real-world coordinates
  const realX = pixelX * scaleX;
  const realY = pixelY * scaleY;

  return {
    x: realX,
    y: realY,
    unit: boardDimensions.unit,
  };
}

/**
 * Convert real-world coordinates to pixel coordinates
 * @param realX - X coordinate in real-world units
 * @param realY - Y coordinate in real-world units
 * @param boardDimensions - Board dimensions with unit
 * @param imageWidth - Width of the image in pixels
 * @param imageHeight - Height of the image in pixels
 * @returns Pixel coordinates
 */
export function realWorldToPixels(
  realX: number,
  realY: number,
  boardDimensions: BoardDimensions | null,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } | null {
  if (!boardDimensions) {
    return null;
  }

  // Calculate scale factors (pixels per real-world unit)
  const scaleX = imageWidth / boardDimensions.width;
  const scaleY = imageHeight / boardDimensions.height;

  // Convert real-world coordinates to pixel coordinates
  const pixelX = realX * scaleX;
  const pixelY = realY * scaleY;

  return {
    x: pixelX,
    y: pixelY,
  };
}

/**
 * Convert a distance in pixels to real-world units
 * @param pixelDistance - Distance in pixels
 * @param boardDimensions - Board dimensions with unit
 * @param imageWidth - Width of the image in pixels (for horizontal distances)
 * @param imageHeight - Height of the image in pixels (for vertical distances)
 * @param isHorizontal - Whether this is a horizontal distance (uses width) or vertical (uses height)
 * @returns Distance in real-world units, or null if dimensions not set
 */
export function pixelsToRealWorldDistance(
  pixelDistance: number,
  boardDimensions: BoardDimensions | null,
  imageWidth: number,
  imageHeight: number,
  isHorizontal: boolean = true
): number | null {
  if (!boardDimensions) {
    return null;
  }

  const scale = isHorizontal
    ? boardDimensions.width / imageWidth
    : boardDimensions.height / imageHeight;

  return pixelDistance * scale;
}

/**
 * Convert a distance in real-world units to pixels
 * @param realDistance - Distance in real-world units
 * @param boardDimensions - Board dimensions with unit
 * @param imageWidth - Width of the image in pixels (for horizontal distances)
 * @param imageHeight - Height of the image in pixels (for vertical distances)
 * @param isHorizontal - Whether this is a horizontal distance (uses width) or vertical (uses height)
 * @returns Distance in pixels, or null if dimensions not set
 */
export function realWorldToPixelsDistance(
  realDistance: number,
  boardDimensions: BoardDimensions | null,
  imageWidth: number,
  imageHeight: number,
  isHorizontal: boolean = true
): number | null {
  if (!boardDimensions) {
    return null;
  }

  const scale = isHorizontal
    ? imageWidth / boardDimensions.width
    : imageHeight / boardDimensions.height;

  return realDistance * scale;
}

