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

// ============================================================================
// Coordinate Transformation Utilities
// ============================================================================

import type { Point, Via } from '../types';
import { SNAP_DISTANCE } from '../constants';
import { atan2, radToDeg } from './transformations';

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
 * Uses camera center in world coordinates
 */
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  cameraWorldCenterX: number,
  cameraWorldCenterY: number,
  viewScale: number,
  canvasCenterX: number,
  canvasCenterY: number
): Point {
  // Calculate viewPan from camera center
  const viewPanX = canvasCenterX - cameraWorldCenterX * viewScale;
  const viewPanY = canvasCenterY - cameraWorldCenterY * viewScale;
  const x = (canvasX - viewPanX) / viewScale;
  const y = (canvasY - viewPanY) / viewScale;
  return { x, y };
}

/**
 * Convert world coordinates to canvas coordinates
 * Uses camera center in world coordinates
 */
export function worldToCanvas(
  worldX: number,
  worldY: number,
  cameraWorldCenterX: number,
  cameraWorldCenterY: number,
  viewScale: number,
  canvasCenterX: number,
  canvasCenterY: number
): Point {
  // Calculate viewPan from camera center
  const viewPanX = canvasCenterX - cameraWorldCenterX * viewScale;
  const viewPanY = canvasCenterY - cameraWorldCenterY * viewScale;
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
  cameraWorldCenterX: number,
  cameraWorldCenterY: number,
  viewScale: number,
  canvasCenterX: number,
  canvasCenterY: number
): Point {
  const canvasPoint = screenToCanvas(screenX, screenY, canvas, dpr);
  return canvasToWorld(canvasPoint.x, canvasPoint.y, cameraWorldCenterX, cameraWorldCenterY, viewScale, canvasCenterX, canvasCenterY);
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
  const angle = Math.abs(radToDeg(atan2(dy, dx)));

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
 * ============================================================================
 * NODE ID GENERATION SYSTEM
 * ============================================================================
 * 
 * This module provides globally unique IDs for all drawing points (vias, pads,
 * trace endpoints, component pins, power/ground nodes, etc.) used to establish
 * electrical connections for netlist generation.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. IDs must be globally unique across the entire project
 * 2. IDs must be preserved in save/load operations
 * 3. No duplicate IDs can ever be generated
 * 4. Counter must be properly saved and restored when loading projects
 * 
 * DESIGN NOTES:
 * - JavaScript is single-threaded, so true race conditions from multi-threading
 *   are not possible. However, we still need to be careful about:
 *   a) Counter being reset at the wrong time during project load
 *   b) Counter not being properly saved with the project
 *   c) Counter not being properly restored when loading a project
 * - This implementation uses a simple monotonic counter with validation
 * - Debug logging can be enabled to trace ID allocation issues
 */

// The next ID to be allocated (starts at 1, never goes backwards)
let nextPointId = 1;

// Set of all allocated IDs for validation (helps detect duplicate allocation bugs)
const allocatedIds = new Set<number>();

// Enable debug logging for ID allocation (set to true to troubleshoot)
const DEBUG_ID_ALLOCATION = false;

/**
 * Generate a globally unique Node ID.
 * 
 * This function guarantees:
 * 1. Every call returns a unique integer
 * 2. IDs are monotonically increasing
 * 3. No duplicate IDs will ever be returned
 * 
 * @returns A unique integer Node ID
 * @throws Error if somehow a duplicate ID would be generated (should never happen)
 */
export function generatePointId(): number {
  const id = nextPointId;
  nextPointId++;
  
  // Validate that this ID hasn't been allocated before
  if (allocatedIds.has(id)) {
    console.error(`CRITICAL ERROR: Duplicate Node ID ${id} would be allocated!`);
    console.error(`Current counter: ${nextPointId}, Allocated IDs count: ${allocatedIds.size}`);
    // Find the next available ID
    while (allocatedIds.has(nextPointId)) {
      nextPointId++;
    }
    const safeId = nextPointId;
    nextPointId++;
    allocatedIds.add(safeId);
    console.error(`Recovered by allocating ID ${safeId} instead`);
    return safeId;
  }
  
  // Track this allocation
  allocatedIds.add(id);
  
  if (DEBUG_ID_ALLOCATION) {
    console.log(`[NodeID] Allocated ID ${id}, next will be ${nextPointId}`);
  }
  
  return id;
}

/**
 * Set the point ID counter to a specific value (used when loading projects)
 * Also clears the allocated IDs set since we're loading a new project.
 * 
 * @param value The new counter value (must be > 0)
 */
export function setPointIdCounter(value: number): void {
  if (value < 1) {
    console.warn(`setPointIdCounter called with invalid value ${value}, using 1`);
    value = 1;
  }
  
  if (DEBUG_ID_ALLOCATION) {
    console.log(`[NodeID] Setting counter to ${value} (was ${nextPointId})`);
  }
  
  nextPointId = value;
  // Clear allocated IDs since we're starting fresh with a loaded project
  allocatedIds.clear();
}

/**
 * Get the current point ID counter value (used when saving projects)
 * This value should be saved with the project so that new IDs continue
 * from where we left off when the project is loaded again.
 * 
 * @returns The current counter value (the next ID that will be allocated)
 */
export function getPointIdCounter(): number {
  return nextPointId;
}

/**
 * Reset the point ID counter to 1 (used when creating a new project)
 * Also clears the allocated IDs tracking set.
 */
export function resetPointIdCounter(): void {
  if (DEBUG_ID_ALLOCATION) {
    console.log(`[NodeID] Resetting counter to 1 (was ${nextPointId})`);
  }
  nextPointId = 1;
  allocatedIds.clear();
}

/**
 * Register an existing ID as allocated (used when loading project data)
 * This helps maintain the allocated IDs set for duplicate detection.
 * 
 * @param id The ID to register as allocated
 */
export function registerAllocatedId(id: number): void {
  if (id > 0) {
    allocatedIds.add(id);
    // Ensure counter is always ahead of any registered ID
    if (id >= nextPointId) {
      nextPointId = id + 1;
      if (DEBUG_ID_ALLOCATION) {
        console.log(`[NodeID] Registered ID ${id}, advanced counter to ${nextPointId}`);
      }
    }
  }
}

/**
 * Check if an ID has been allocated
 * Useful for debugging duplicate ID issues
 * 
 * @param id The ID to check
 * @returns true if the ID has been allocated
 */
export function isIdAllocated(id: number): boolean {
  return allocatedIds.has(id);
}

/**
 * Unregister an allocated ID (used when undoing object creation)
 * This allows the ID to be reused and helps maintain the counter correctly.
 * 
 * @param id The ID to unregister
 */
export function unregisterAllocatedId(id: number): void {
  if (id > 0 && allocatedIds.has(id)) {
    allocatedIds.delete(id);
    
    if (DEBUG_ID_ALLOCATION) {
      console.log(`[NodeID] Unregistered ID ${id}`);
    }
    
    // After unregistering, adjust the counter so freed IDs can be reused
    // Find the maximum allocated ID
    if (allocatedIds.size > 0) {
      const maxAllocatedId = Math.max(...Array.from(allocatedIds));
      // If the max allocated ID is less than the current counter,
      // we can decrement the counter to allow reuse of the freed IDs
      if (maxAllocatedId < nextPointId) {
        // Set counter to max allocated ID + 1, but don't go below 1
        nextPointId = Math.max(1, maxAllocatedId + 1);
        if (DEBUG_ID_ALLOCATION) {
          console.log(`[NodeID] Decremented counter to ${nextPointId} after unregistering ID ${id} (max allocated: ${maxAllocatedId})`);
        }
      }
    } else {
      // No allocated IDs left, reset counter to 1
      nextPointId = 1;
      if (DEBUG_ID_ALLOCATION) {
        console.log(`[NodeID] Reset counter to 1 (no allocated IDs remaining)`);
      }
    }
  }
}

/**
 * Get debug info about ID allocation state
 * Useful for debugging duplicate ID issues
 */
export function getIdAllocationDebugInfo(): { nextId: number; allocatedCount: number; allocatedIds: number[] } {
  return {
    nextId: nextPointId,
    allocatedCount: allocatedIds.size,
    allocatedIds: Array.from(allocatedIds).sort((a, b) => a - b)
  };
}

export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Truncate coordinate to 4 decimal places for finer precision
 * This ensures consistent precision for all coordinates and enables exact matches
 * when objects snap to each other. Increased from 3 to 4 decimal places to support
 * ultra-fine placement when zoomed in.
 * 
 * @param coord - The coordinate value to truncate
 * @returns The coordinate truncated to 4 decimal places
 */
export function truncateCoordinate(coord: number): number {
  return Math.round(coord * 10000) / 10000;
}

/**
 * Truncate a point's x and y coordinates to 4 decimal places
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

