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
  const rad = (rotationDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    // scale (with flipping encoded by negative scale), then rotate
    const sx = p.x * scaleX;
    const sy = p.y * scaleY;
    const rx = sx * cos - sy * sin;
    const ry = sx * sin + sy * cos;
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


