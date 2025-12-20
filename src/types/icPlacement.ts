/**
 * Types for IC Pin-Matched Via/Pad Placement
 */

export interface Point {
  x: number;
  y: number;
}

export interface PadLocation {
  pinNumber: number;
  x: number;
  y: number;
}

export type ComponentType = 'linear' | 'twoSided' | 'fourSided';

// For 2-sided, specifies which edges have pins
export type TwoSidedOrientation = 'vertical-edges' | 'horizontal-edges';

export interface ComponentInput {
  numPins: number;
  type: ComponentType;
  twoSidedOrientation?: TwoSidedOrientation; // Required if type is 'twoSided'
  point1: Point; // User click (Pin 1 location)
  point2: Point; // User release (Diagonally opposite)
}

export interface RectangleCorners {
  corner1: Point; // Pin 1 (click point)
  corner2: Point; // Same x as corner3, same y as corner1
  corner3: Point; // Release point (diagonally opposite)
  corner4: Point; // Same x as corner1, same y as corner3
}

