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
// Canvas Drawing Utilities
// ============================================================================

import type { 
  PCBImage, 
  Via, 
  DrawingStroke, 
  PCBComponent, 
  GroundSymbol
} from '../types';
import { 
  VIA, 
  GROUND_SYMBOL, 
  SELECTION_COLOR, 
  SELECTION_DASH, 
  SELECTION_LINE_WIDTH 
} from '../constants';

/**
 * Draw a via (bullseye pattern)
 */
export function drawVia(
  ctx: CanvasRenderingContext2D,
  via: Via,
  viewScale: number,
  isSelected: boolean = false
): void {
  const outerRadius = (via.size || VIA.DEFAULT_SIZE) / 2;
  const innerRadius = outerRadius * VIA.INNER_CIRCLE_RATIO;

  ctx.save();

  // Selection highlight
  if (isSelected) {
    ctx.setLineDash(SELECTION_DASH);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = SELECTION_LINE_WIDTH;
    ctx.beginPath();
    ctx.arc(via.x, via.y, outerRadius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Outer circle
  ctx.strokeStyle = via.color;
  ctx.lineWidth = Math.max(1, 2 / Math.max(viewScale, 0.001));
  ctx.beginPath();
  ctx.arc(via.x, via.y, outerRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner filled circle
  ctx.fillStyle = via.color;
  ctx.beginPath();
  ctx.arc(via.x, via.y, innerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a trace (polyline)
 * @param showCornerDots - If true, draw filled circles at each vertex/corner (default: true)
 */
export function drawTrace(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  viewScale: number,
  isSelected: boolean = false,
  showCornerDots: boolean = true
): void {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.size / Math.max(viewScale, 0.001));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Selection highlight
  if (isSelected) {
    ctx.setLineDash(SELECTION_DASH);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = Math.max(1, (stroke.size + 4) / Math.max(viewScale, 0.001));
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, stroke.size / Math.max(viewScale, 0.001));
  }

  // Draw the trace
  if (stroke.points.length === 1) {
    // Single point - draw as circle
    const pt = stroke.points[0];
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Multiple points - draw as polyline
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();

    // Draw points at each vertex (optional)
    if (showCornerDots) {
    for (const pt of stroke.points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Draw a component icon (chip with pins)
 */
export function drawComponent(
  ctx: CanvasRenderingContext2D,
  component: PCBComponent,
  viewScale: number,
  isSelected: boolean = false
): void {
  const size = component.size || 24;
  const chipWidth = size * 0.8;
  const chipHeight = size * 0.6;
  const pinLength = size * 0.15;
  const pinSpacing = chipHeight / 4;

  ctx.save();
  ctx.translate(component.x, component.y);

  // Selection highlight
  if (isSelected) {
    ctx.setLineDash(SELECTION_DASH);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = SELECTION_LINE_WIDTH;
    ctx.strokeRect(-chipWidth / 2 - 3, -chipHeight / 2 - 3, chipWidth + 6, chipHeight + 6);
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = component.color;
  ctx.lineWidth = Math.max(1, 2 / Math.max(viewScale, 0.001));

  // Draw chip body
  ctx.strokeRect(-chipWidth / 2, -chipHeight / 2, chipWidth, chipHeight);

  // Draw pins (3 on each side)
  for (let i = 0; i < 3; i++) {
    const y = -chipHeight / 2 + chipHeight / 4 + i * pinSpacing;
    // Left pins
    ctx.beginPath();
    ctx.moveTo(-chipWidth / 2, y);
    ctx.lineTo(-chipWidth / 2 - pinLength, y);
    ctx.stroke();
    // Right pins
    ctx.beginPath();
    ctx.moveTo(chipWidth / 2, y);
    ctx.lineTo(chipWidth / 2 + pinLength, y);
    ctx.stroke();
  }

  // Draw notch (pin 1 indicator)
  ctx.beginPath();
  ctx.arc(0, -chipHeight / 2, chipWidth * 0.1, 0, Math.PI, true);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a ground symbol
 */
export function drawGroundSymbol(
  ctx: CanvasRenderingContext2D,
  ground: GroundSymbol,
  viewScale: number,
  isSelected: boolean = false
): void {
  const unit = Math.max(GROUND_SYMBOL.MIN_SIZE, ground.size || GROUND_SYMBOL.DEFAULT_SIZE);
  const vLen = unit * GROUND_SYMBOL.VERTICAL_LINE_RATIO;
  const barG = unit * GROUND_SYMBOL.BAR_GAP_RATIO;
  const width = unit * GROUND_SYMBOL.WIDTH_RATIO;
  const halfWidth = width / 2;

  ctx.save();
  ctx.translate(ground.x, ground.y); // Anchor point is the top of the vertical line

  // Selection highlight
  if (isSelected) {
    ctx.setLineDash(SELECTION_DASH);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = SELECTION_LINE_WIDTH;
    ctx.strokeRect(-halfWidth - 3, -3, width + 6, vLen + barG * 2 + 6);
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = ground.color;
  ctx.lineWidth = Math.max(1, 2 / Math.max(viewScale, 0.001));
  ctx.lineCap = 'round';

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, vLen);
  ctx.stroke();

  // Horizontal bars
  for (let i = 0; i < 3; i++) {
    const barY = vLen + i * barG;
    const barWidth = width * (1 - i * 0.25);
    ctx.beginPath();
    ctx.moveTo(-barWidth / 2, barY);
    ctx.lineTo(barWidth / 2, barY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a selection rectangle
 */
export function drawSelectionRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.setLineDash(SELECTION_DASH);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = SELECTION_LINE_WIDTH;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = 'rgba(0, 191, 255, 0.1)';
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

/**
 * Draw an image with transformations applied
 */
export function drawTransformedImage(
  ctx: CanvasRenderingContext2D,
  image: PCBImage,
  isGrayscale: boolean = false,
  isEdgeDetect: boolean = false
): void {
  if (!image.bitmap) return;

  ctx.save();
  ctx.translate(image.x, image.y);
  ctx.rotate(image.rotation);
  ctx.scale(
    image.scale * (image.flipX ? -1 : 1),
    image.scale * (image.flipY ? -1 : 1)
  );

  // Apply skew if present
  if (image.skewX || image.skewY) {
    ctx.transform(
      1,
      image.skewY || 0,
      image.skewX || 0,
      1,
      0,
      0
    );
  }

  // Draw the image
  ctx.drawImage(
    image.bitmap,
    -image.width / 2,
    -image.height / 2,
    image.width,
    image.height
  );

  // Apply filters if needed
  if (isGrayscale || isEdgeDetect) {
    const imageData = ctx.getImageData(
      -image.width / 2,
      -image.height / 2,
      image.width,
      image.height
    );
    
    if (isGrayscale) {
      applyGrayscale(imageData);
    }
    
    if (isEdgeDetect) {
      applyEdgeDetection(imageData);
    }
    
    ctx.putImageData(imageData, -image.width / 2, -image.height / 2);
  }

  ctx.restore();
}

/**
 * Apply grayscale filter to image data
 */
function applyGrayscale(imageData: ImageData): void {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
}

/**
 * Apply simple edge detection filter to image data
 */
function applyEdgeDetection(imageData: ImageData): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Sobel operator
      const gx =
        -data[((y - 1) * width + (x - 1)) * 4] +
        data[((y - 1) * width + (x + 1)) * 4] +
        -2 * data[(y * width + (x - 1)) * 4] +
        2 * data[(y * width + (x + 1)) * 4] +
        -data[((y + 1) * width + (x - 1)) * 4] +
        data[((y + 1) * width + (x + 1)) * 4];

      const gy =
        -data[((y - 1) * width + (x - 1)) * 4] +
        -2 * data[((y - 1) * width + x) * 4] +
        -data[((y - 1) * width + (x + 1)) * 4] +
        data[((y + 1) * width + (x - 1)) * 4] +
        2 * data[((y + 1) * width + x) * 4] +
        data[((y + 1) * width + (x + 1)) * 4];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      output[idx] = output[idx + 1] = output[idx + 2] = magnitude;
    }
  }

  data.set(output);
}

/**
 * Clear the canvas
 */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Set up high-DPI canvas
 */
export function setupHiDPICanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): number {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  
  return dpr;
}

