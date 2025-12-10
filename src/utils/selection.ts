/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
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

// ============================================================================
// Selection Utilities
// ============================================================================

import type { 
  Via, 
  DrawingStroke, 
  PCBComponent, 
  GroundSymbol,
  Point 
} from '../types';
import { 
  VIA, 
  GROUND_SYMBOL, 
  COMPONENT_ICON 
} from '../constants';
import { distance, distanceToSegment } from './coordinates';

/**
 * Check if a point is inside a via
 */
export function isPointInVia(point: Point, via: Via): boolean {
  const radius = (via.size || VIA.DEFAULT_SIZE) / 2;
  return distance(point, { x: via.x, y: via.y }) <= radius;
}

/**
 * Check if a via is inside a rectangle
 */
export function isViaInRect(
  via: Via,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  const radius = (via.size || VIA.DEFAULT_SIZE) / 2;
  const minX = Math.min(rectX, rectX + rectWidth);
  const maxX = Math.max(rectX, rectX + rectWidth);
  const minY = Math.min(rectY, rectY + rectHeight);
  const maxY = Math.max(rectY, rectY + rectHeight);
  
  return (
    via.x - radius >= minX &&
    via.x + radius <= maxX &&
    via.y - radius >= minY &&
    via.y + radius <= maxY
  );
}

/**
 * Check if a point is on a trace
 */
export function isPointOnTrace(point: Point, trace: DrawingStroke, threshold: number = 5): boolean {
  if (trace.points.length === 0) return false;
  
  // Check if point is on any segment
  for (let i = 0; i < trace.points.length - 1; i++) {
    const dist = distanceToSegment(
      point,
      { x: trace.points[i].x, y: trace.points[i].y },
      { x: trace.points[i + 1].x, y: trace.points[i + 1].y }
    );
    
    if (dist <= threshold + trace.size / 2) {
      return true;
    }
  }
  
  // Check if point is on any vertex
  for (const pt of trace.points) {
    if (distance(point, { x: pt.x, y: pt.y }) <= threshold + trace.size / 2) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a trace intersects with a rectangle
 */
export function isTraceInRect(
  trace: DrawingStroke,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  if (trace.points.length === 0) return false;
  
  const minX = Math.min(rectX, rectX + rectWidth);
  const maxX = Math.max(rectX, rectX + rectWidth);
  const minY = Math.min(rectY, rectY + rectHeight);
  const maxY = Math.max(rectY, rectY + rectHeight);
  
  // Check if any point is inside the rectangle
  for (const pt of trace.points) {
    if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
      return true;
    }
  }
  
  // Check if any segment intersects the rectangle
  for (let i = 0; i < trace.points.length - 1; i++) {
    const p1 = trace.points[i];
    const p2 = trace.points[i + 1];
    
    if (lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, minX, minY, maxX, maxY)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a line segment intersects with a rectangle
 */
function lineIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rectMinX: number,
  rectMinY: number,
  rectMaxX: number,
  rectMaxY: number
): boolean {
  // Check if either endpoint is inside the rectangle
  if (
    (x1 >= rectMinX && x1 <= rectMaxX && y1 >= rectMinY && y1 <= rectMaxY) ||
    (x2 >= rectMinX && x2 <= rectMaxX && y2 >= rectMinY && y2 <= rectMaxY)
  ) {
    return true;
  }
  
  // Check if the line intersects any of the rectangle's edges
  return (
    lineSegmentsIntersect(x1, y1, x2, y2, rectMinX, rectMinY, rectMaxX, rectMinY) ||
    lineSegmentsIntersect(x1, y1, x2, y2, rectMaxX, rectMinY, rectMaxX, rectMaxY) ||
    lineSegmentsIntersect(x1, y1, x2, y2, rectMaxX, rectMaxY, rectMinX, rectMaxY) ||
    lineSegmentsIntersect(x1, y1, x2, y2, rectMinX, rectMaxY, rectMinX, rectMinY)
  );
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;
  
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Check if a point is inside a component
 */
export function isPointInComponent(point: Point, component: PCBComponent): boolean {
  const size = component.size || COMPONENT_ICON.DEFAULT_SIZE;
  const halfWidth = size * 0.8 / 2;
  const halfHeight = size * 0.6 / 2;
  
  return (
    point.x >= component.x - halfWidth &&
    point.x <= component.x + halfWidth &&
    point.y >= component.y - halfHeight &&
    point.y <= component.y + halfHeight
  );
}

/**
 * Check if a component is inside a rectangle
 */
export function isComponentInRect(
  component: PCBComponent,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  const size = component.size || COMPONENT_ICON.DEFAULT_SIZE;
  const halfWidth = size * 0.8 / 2;
  const halfHeight = size * 0.6 / 2;
  
  const minX = Math.min(rectX, rectX + rectWidth);
  const maxX = Math.max(rectX, rectX + rectWidth);
  const minY = Math.min(rectY, rectY + rectHeight);
  const maxY = Math.max(rectY, rectY + rectHeight);
  
  return (
    component.x - halfWidth >= minX &&
    component.x + halfWidth <= maxX &&
    component.y - halfHeight >= minY &&
    component.y + halfHeight <= maxY
  );
}

/**
 * Check if a point is inside a ground symbol
 */
export function isPointInGround(point: Point, ground: GroundSymbol): boolean {
  const unit = Math.max(GROUND_SYMBOL.MIN_SIZE, ground.size || GROUND_SYMBOL.DEFAULT_SIZE);
  const vLen = unit * GROUND_SYMBOL.VERTICAL_LINE_RATIO;
  const barG = unit * GROUND_SYMBOL.BAR_GAP_RATIO;
  const width = unit * GROUND_SYMBOL.WIDTH_RATIO;
  
  const minX = ground.x - width / 2;
  const maxX = ground.x + width / 2;
  const minY = ground.y;
  const maxY = ground.y + vLen + barG * 2;
  
  return (
    point.x >= minX &&
    point.x <= maxX &&
    point.y >= minY &&
    point.y <= maxY
  );
}

/**
 * Check if a ground symbol is inside a rectangle
 */
export function isGroundInRect(
  ground: GroundSymbol,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  const unit = Math.max(GROUND_SYMBOL.MIN_SIZE, ground.size || GROUND_SYMBOL.DEFAULT_SIZE);
  const vLen = unit * GROUND_SYMBOL.VERTICAL_LINE_RATIO;
  const barG = unit * GROUND_SYMBOL.BAR_GAP_RATIO;
  const width = unit * GROUND_SYMBOL.WIDTH_RATIO;
  
  const gMinX = ground.x - width / 2;
  const gMaxX = ground.x + width / 2;
  const gMinY = ground.y;
  const gMaxY = ground.y + vLen + barG * 2;
  
  const minX = Math.min(rectX, rectX + rectWidth);
  const maxX = Math.max(rectX, rectX + rectWidth);
  const minY = Math.min(rectY, rectY + rectHeight);
  const maxY = Math.max(rectY, rectY + rectHeight);
  
  return (
    gMinX >= minX &&
    gMaxX <= maxX &&
    gMinY >= minY &&
    gMaxY <= maxY
  );
}

/**
 * Get all vias within a selection rectangle
 */
export function selectViasInRect(
  vias: Via[],
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): string[] {
  return vias
    .filter(via => isViaInRect(via, rectX, rectY, rectWidth, rectHeight))
    .map(via => via.id);
}

/**
 * Get all traces within a selection rectangle
 */
export function selectTracesInRect(
  traces: DrawingStroke[],
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): string[] {
  return traces
    .filter(trace => isTraceInRect(trace, rectX, rectY, rectWidth, rectHeight))
    .map(trace => trace.id);
}

/**
 * Get all components within a selection rectangle
 */
export function selectComponentsInRect(
  components: PCBComponent[],
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): string[] {
  return components
    .filter(comp => isComponentInRect(comp, rectX, rectY, rectWidth, rectHeight))
    .map(comp => comp.id);
}

/**
 * Get all ground symbols within a selection rectangle
 */
export function selectGroundsInRect(
  grounds: GroundSymbol[],
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): string[] {
  return grounds
    .filter(ground => isGroundInRect(ground, rectX, rectY, rectWidth, rectHeight))
    .map(ground => ground.id);
}

