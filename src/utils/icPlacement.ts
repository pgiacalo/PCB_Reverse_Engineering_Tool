/**
 * IC Pin-Matched Via/Pad Placement Algorithm
 * 
 * Implements the algorithm described in the plan:
 * - User clicks at Pin 1 location (corner 1)
 * - User drags and releases at diagonally opposite corner (corner 3)
 * - System places vias/pads along outside edges in CCW order: corner 1 → corner 2 → corner 3 → corner 4
 */

import type { Point, PadLocation, ComponentInput, RectangleCorners } from '../types/icPlacement';

/**
 * Calculate all four corners from click (corner1 = Pin 1) and release (corner3)
 */
export function calculateCorners(point1: Point, point2: Point): RectangleCorners {
  const corner1 = { x: point1.x, y: point1.y }; // Pin 1 (click point)
  const corner3 = { x: point2.x, y: point2.y }; // Diagonally opposite (release point)
  const corner2 = { x: corner3.x, y: corner1.y }; // Same x as corner3, same y as corner1
  const corner4 = { x: corner1.x, y: corner3.y }; // Same x as corner1, same y as corner3
  return { corner1, corner2, corner3, corner4 };
}

/**
 * Generate positions along an edge with proper spacing
 */
export function generatePositionsOnEdge(
  startCorner: Point,
  endCorner: Point,
  count: number
): Point[] {
  const dx = endCorner.x - startCorner.x;
  const dy = endCorner.y - startCorner.y;
  const edgeLength = Math.hypot(dx, dy);
  
  if (edgeLength < 0.001 || count < 1) return [];
  
  const positions: Point[] = [];
  const spacing = edgeLength / (count + 1); // L / (N+1)
  const margin = spacing;
  
  for (let i = 1; i <= count; i++) {
    const t = (margin + (i - 1) * spacing) / edgeLength;
    positions.push({
      x: startCorner.x + dx * t,
      y: startCorner.y + dy * t
    });
  }
  
  return positions;
}

/**
 * Validate input parameters
 */
function validateInput(input: ComponentInput): void {
  if (input.numPins < 1) {
    throw new Error("Number of pins must be >= 1.");
  }
  
  if (input.type === 'twoSided') {
    if (input.numPins % 2 !== 0) {
      throw new Error("2-sided components must have an even number of pins.");
    }
    if (!input.twoSidedOrientation) {
      throw new Error("Orientation required for 2-sided components.");
    }
  }
  
  if (input.type === 'fourSided') {
    if (input.numPins % 4 !== 0) {
      throw new Error("4-sided components must have N divisible by 4.");
    }
  }
  
  if (Math.abs(input.point1.x - input.point2.x) < 0.001 || Math.abs(input.point1.y - input.point2.y) < 0.001) {
    throw new Error("Area must have non-zero width and height.");
  }
}

/**
 * Generate linear (1-sided) arrangement
 */
function generateLinearPads(input: ComponentInput, corners: RectangleCorners): PadLocation[] {
  const pads: PadLocation[] = [];
  const { corner1, corner2, corner3, corner4 } = corners;
  
  // Calculate rectangle dimensions
  const width = Math.abs(corner2.x - corner1.x);
  const height = Math.abs(corner3.y - corner2.y);
  
    // Determine longest dimension and centerline
    if (width > height) {
      // Horizontal centerline
      const centerY = (corner1.y + corner4.y) / 2;
      const leftX = Math.min(corner1.x, corner2.x);
      const rightX = Math.max(corner1.x, corner2.x);
      const centerlineLength = rightX - leftX;
      
      // Spacing formula: S = L/(Z-1), with pins at start and end (zero spacing at edges)
      const spacing = input.numPins > 1 ? centerlineLength / (input.numPins - 1) : 0;
      
      // Determine direction: start from end nearest to Pin 1 (corner1)
      const distToLeft = Math.hypot(corner1.x - leftX, corner1.y - centerY);
      const distToRight = Math.hypot(corner1.x - rightX, corner1.y - centerY);
      const startFromLeft = distToLeft < distToRight;
      
      if (input.numPins === 1) {
        // Single pin: place at center
        pads.push({ pinNumber: 1, x: (leftX + rightX) / 2, y: centerY });
      } else {
        for (let k = 1; k <= input.numPins; k++) {
          const x = startFromLeft 
            ? leftX + (k - 1) * spacing
            : rightX - (k - 1) * spacing;
          pads.push({ pinNumber: k, x, y: centerY });
        }
      }
    } else {
      // Vertical centerline
      const centerX = (corner1.x + corner2.x) / 2;
      const topY = Math.min(corner1.y, corner2.y);
      const bottomY = Math.max(corner3.y, corner4.y);
      const centerlineLength = bottomY - topY;
      
      // Spacing formula: S = L/(Z-1), with pins at start and end (zero spacing at edges)
      const spacing = input.numPins > 1 ? centerlineLength / (input.numPins - 1) : 0;
      
      // Start from end nearest to Pin 1 (corner1)
      const distToTop = Math.hypot(corner1.x - centerX, corner1.y - topY);
      const distToBottom = Math.hypot(corner1.x - centerX, corner1.y - bottomY);
      const startFromTop = distToTop < distToBottom;
      
      if (input.numPins === 1) {
        // Single pin: place at center
        pads.push({ pinNumber: 1, x: centerX, y: (topY + bottomY) / 2 });
      } else {
        for (let k = 1; k <= input.numPins; k++) {
          const y = startFromTop
            ? topY + (k - 1) * spacing
            : bottomY - (k - 1) * spacing;
          pads.push({ pinNumber: k, x: centerX, y });
        }
      }
    }
  
  return pads;
}

/**
 * Generate 2-sided or 4-sided rectangular arrangement
 * Follows strict CCW rules:
 * - Left Edge: Down (y increases)
 * - Bottom Edge: Right (x increases)
 * - Right Edge: Up (y decreases)
 * - Top Edge: Left (x decreases)
 * - Row 1 is the side immediately CCW from Pin 1 Corner
 */
function generateRectangularPads(input: ComponentInput, corners: RectangleCorners): PadLocation[] {
  const pads: PadLocation[] = [];
  const { corner1, corner2, corner3, corner4 } = corners;
  
  // Calculate pins per side
  const pinsPerSide = input.type === 'fourSided' 
    ? input.numPins / 4 
    : input.numPins / 2;
  
  // Calculate bounding box to determine corner positions
  const minX = Math.min(corner1.x, corner2.x, corner3.x, corner4.x);
  const minY = Math.min(corner1.y, corner2.y, corner3.y, corner4.y);
  
  // corner1 is Pin 1 (the click point)
  // Determine which corner of the rectangle corner1 represents
  // Based on calculateCorners: corner1 = click, corner3 = release (diagonally opposite)
  // corner2 = (corner3.x, corner1.y), corner4 = (corner1.x, corner3.y)
  const isTop = Math.abs(corner1.y - minY) < 0.001;
  const isLeft = Math.abs(corner1.x - minX) < 0.001;
  const pin1Position = isTop 
    ? (isLeft ? 'TopLeft' : 'TopRight')
    : (isLeft ? 'BottomLeft' : 'BottomRight');
  
  // Map corners to actual rectangle edges
  // corner1 is Pin 1 (click point)
  // corner3 is diagonally opposite (release point)
  // corner2 = (corner3.x, corner1.y) - same x as corner3, same y as corner1
  // corner4 = (corner1.x, corner3.y) - same x as corner1, same y as corner3
  // 
  // To find the actual rectangle corners, we need to determine which of the 4 calculated corners
  // corresponds to each actual corner position (top-left, top-right, bottom-right, bottom-left)
  const maxX = Math.max(corner1.x, corner2.x, corner3.x, corner4.x);
  const maxY = Math.max(corner1.y, corner2.y, corner3.y, corner4.y);
  
  // Find which corner is at each position
  const findCornerAt = (x: number, y: number, threshold: number = 0.001) => {
    const corners = [corner1, corner2, corner3, corner4];
    for (const c of corners) {
      if (Math.abs(c.x - x) < threshold && Math.abs(c.y - y) < threshold) {
        return c;
      }
    }
    return null;
  };
  
  const topLeftCorner = findCornerAt(minX, minY) || corner1;
  const topRightCorner = findCornerAt(maxX, minY) || corner2;
  const bottomRightCorner = findCornerAt(maxX, maxY) || corner3;
  const bottomLeftCorner = findCornerAt(minX, maxY) || corner4;
  
  // Define edges in CCW order with their directions
  // Left Edge: Down (y increases) - from Top-Left to Bottom-Left
  // Bottom Edge: Right (x increases) - from Bottom-Left to Bottom-Right
  // Right Edge: Up (y decreases) - from Bottom-Right to Top-Right
  // Top Edge: Left (x decreases) - from Top-Right to Top-Left
  const leftEdge = { start: topLeftCorner, end: bottomLeftCorner, name: 'Left', direction: 'Down' };
  const bottomEdge = { start: bottomLeftCorner, end: bottomRightCorner, name: 'Bottom', direction: 'Right' };
  const rightEdge = { start: bottomRightCorner, end: topRightCorner, name: 'Right', direction: 'Up' };
  const topEdge = { start: topRightCorner, end: topLeftCorner, name: 'Top', direction: 'Left' };
  
  // Determine Row 1 based on Pin 1 Corner (immediately CCW from Pin 1)
  // If Pin 1 is Top-Left: Row 1 is Left Edge (Going Down)
  // If Pin 1 is Bottom-Left: Row 1 is Bottom Edge (Going Right)
  // If Pin 1 is Bottom-Right: Row 1 is Right Edge (Going Up)
  // If Pin 1 is Top-Right: Row 1 is Top Edge (Going Left)
  let row1Edge: typeof leftEdge;
  const edgeOrder: Array<typeof leftEdge> = [];
  
  if (pin1Position === 'TopLeft') {
    row1Edge = leftEdge;
    edgeOrder.push(leftEdge, bottomEdge, rightEdge, topEdge);
  } else if (pin1Position === 'BottomLeft') {
    row1Edge = bottomEdge;
    edgeOrder.push(bottomEdge, rightEdge, topEdge, leftEdge);
  } else if (pin1Position === 'BottomRight') {
    row1Edge = rightEdge;
    edgeOrder.push(rightEdge, topEdge, leftEdge, bottomEdge);
  } else { // TopRight
    row1Edge = topEdge;
    edgeOrder.push(topEdge, leftEdge, bottomEdge, rightEdge);
  }
  
  // For 2-sided: Validate Natural Geometric Constraint
  if (input.type === 'twoSided') {
    if (input.twoSidedOrientation === 'vertical-edges') {
      // Left/Right orientation: Pin 1 must be Top-Left or Bottom-Right
      if (pin1Position !== 'TopLeft' && pin1Position !== 'BottomRight') {
        throw new Error(
          `Invalid Pin 1 location for Left/Right orientation. ` +
          `Pin 1 is at ${pin1Position}, but must be at Top-Left or Bottom-Right.`
        );
      }
    } else { // horizontal-edges
      // Top/Bottom orientation: Pin 1 must be Top-Right or Bottom-Left
      if (pin1Position !== 'TopRight' && pin1Position !== 'BottomLeft') {
        throw new Error(
          `Invalid Pin 1 location for Top/Bottom orientation. ` +
          `Pin 1 is at ${pin1Position}, but must be at Top-Right or Bottom-Left.`
        );
      }
    }
  }
  
  // Determine which edges are active
  const activeEdges: Array<typeof leftEdge> = [];
  
  if (input.type === 'fourSided') {
    // All 4 edges are active, starting from Row 1
    activeEdges.push(...edgeOrder);
  } else {
    // 2-sided: determine based on orientation
    if (input.twoSidedOrientation === 'vertical-edges') {
      // Left and Right edges
      // For 2-sided vertical, we need to maintain CCW order
      // If Row 1 is Left Edge: Left → (skip Bottom) → Right → (skip Top) → back to Left
      // If Row 1 is Right Edge: Right → (skip Top) → Left → (skip Bottom) → back to Right
      // So the order should be: Row 1 edge, then the other vertical edge
      if (row1Edge === leftEdge) {
        // Start with Left, then Right (CCW order)
        activeEdges.push(leftEdge, rightEdge);
      } else { // row1Edge === rightEdge
        // Start with Right, then Left (CCW order: Right → Top → Left)
        // But we skip Top, so we go Right then Left
        activeEdges.push(rightEdge, leftEdge);
      }
    } else { // horizontal-edges
      // Top and Bottom edges
      // Reorder to start from Row 1
      if (row1Edge === topEdge) {
        activeEdges.push(topEdge, bottomEdge);
      } else { // row1Edge === bottomEdge
        activeEdges.push(bottomEdge, topEdge);
      }
    }
  }
  
  // Generate positions along edges in CCW order
  let currentPin = 1;
  
  for (const edge of activeEdges) {
    // Calculate edge length
    const edgeLength = Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
    
    // Spacing formula depends on arrangement type:
    // - Linear and 2-sided: S = L/(Z-1), pins at start and end (zero spacing at edges)
    // - 4-sided: S = L/(Z+1), spacing at edges
    const spacing = input.type === 'fourSided'
      ? edgeLength / (pinsPerSide + 1)
      : (pinsPerSide > 1 ? edgeLength / (pinsPerSide - 1) : 0);
    
    // Generate positions along this edge based on direction
    const positions: Point[] = [];
    
    if (input.type === 'fourSided') {
      // 4-sided: spacing at edges (original formula)
      if (edge.direction === 'Down') {
        // Left Edge: Down (y increases)
        for (let i = 1; i <= pinsPerSide; i++) {
          positions.push({ x: edge.start.x, y: edge.start.y + i * spacing });
        }
      } else if (edge.direction === 'Right') {
        // Bottom Edge: Right (x increases)
        for (let i = 1; i <= pinsPerSide; i++) {
          positions.push({ x: edge.start.x + i * spacing, y: edge.start.y });
        }
      } else if (edge.direction === 'Up') {
        // Right Edge: Up (y decreases)
        for (let i = 1; i <= pinsPerSide; i++) {
          positions.push({ x: edge.start.x, y: edge.start.y - i * spacing });
        }
      } else { // Left
        // Top Edge: Left (x decreases)
        for (let i = 1; i <= pinsPerSide; i++) {
          positions.push({ x: edge.start.x - i * spacing, y: edge.start.y });
        }
      }
    } else {
      // 2-sided: pins at start and end (zero spacing at edges)
      if (pinsPerSide === 1) {
        // Single pin: place at center of edge
        const midX = (edge.start.x + edge.end.x) / 2;
        const midY = (edge.start.y + edge.end.y) / 2;
        positions.push({ x: midX, y: midY });
      } else {
        if (edge.direction === 'Down') {
          // Left Edge: Down (y increases) - start at top, end at bottom
          for (let i = 0; i < pinsPerSide; i++) {
            positions.push({ x: edge.start.x, y: edge.start.y + i * spacing });
          }
        } else if (edge.direction === 'Right') {
          // Bottom Edge: Right (x increases) - start at left, end at right
          for (let i = 0; i < pinsPerSide; i++) {
            positions.push({ x: edge.start.x + i * spacing, y: edge.start.y });
          }
        } else if (edge.direction === 'Up') {
          // Right Edge: Up (y decreases) - start at bottom, end at top
          for (let i = 0; i < pinsPerSide; i++) {
            positions.push({ x: edge.start.x, y: edge.start.y - i * spacing });
          }
        } else { // Left
          // Top Edge: Left (x decreases) - start at right, end at left
          for (let i = 0; i < pinsPerSide; i++) {
            positions.push({ x: edge.start.x - i * spacing, y: edge.start.y });
          }
        }
      }
    }
    
    // For Row 1 (first edge), ensure we start from Pin 1 if it's on this edge
    if (edge === row1Edge) {
      // Find which position is closest to Pin 1 (corner1)
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < positions.length; i++) {
        const dist = Math.hypot(positions[i].x - corner1.x, positions[i].y - corner1.y);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      // If Pin 1 is closer to a position than to the corner, reorder to start from that position
      const distToStart = Math.hypot(edge.start.x - corner1.x, edge.start.y - corner1.y);
      if (minDist < distToStart && closestIdx > 0) {
        const before = positions.slice(0, closestIdx);
        const after = positions.slice(closestIdx);
        positions.length = 0;
        positions.push(...after, ...before);
      }
    }
    
    // Add positions in order
    for (const pos of positions) {
      pads.push({ pinNumber: currentPin++, x: pos.x, y: pos.y });
    }
  }
  
  return pads;
}

/**
 * Main entry point to generate pads
 */
export function generateICPlacementPads(input: ComponentInput): PadLocation[] {
  validateInput(input);
  
  const corners = calculateCorners(input.point1, input.point2);
  
  if (input.type === 'linear') {
    return generateLinearPads(input, corners);
  } else {
    return generateRectangularPads(input, corners);
  }
}

