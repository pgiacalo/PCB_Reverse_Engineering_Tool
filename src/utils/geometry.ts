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

import { degToRad, cos, sin } from './transformations';

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function mergeBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function rectTransformedBounds(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  translateX: number,
  translateY: number,
  scaleX: number,
  scaleY: number,
  rotationDeg: number
): Bounds {
  const hw = width / 2;
  const hh = height / 2;
  const points = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  const rad = degToRad(rotationDeg);
  const sinVal = sin(rad);
  const cosVal = cos(rad);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    // scale (with flipping encoded by negative scale), then rotate
    const sx = p.x * scaleX;
    const sy = p.y * scaleY;
    const rx = sx * cosVal - sy * sinVal;
    const ry = sx * sinVal + sy * cosVal;
    // translate into canvas space (relative to canvas center)
    const fx = centerX + translateX + rx;
    const fy = centerY + translateY + ry;
    if (fx < minX) minX = fx;
    if (fy < minY) minY = fy;
    if (fx > maxX) maxX = fx;
    if (fy > maxY) maxY = fy;
  }
  return { minX, minY, maxX, maxY };
}


