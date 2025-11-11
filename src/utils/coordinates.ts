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
 * Generate a unique ID for drawing elements
 */
let nextPointId = 1;

export function generatePointId(): number {
  return nextPointId++;
}

export function resetPointIdCounter(): void {
  nextPointId = 1;
}

export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

