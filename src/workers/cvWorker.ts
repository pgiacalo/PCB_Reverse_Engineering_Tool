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

export type CVParams = { cannyLow: number; cannyHigh: number; blur: number; close: number; open: number };

// Placeholder scaffold; real implementation would use OpenCV.js in worker
self.onmessage = async (e: MessageEvent<{ bitmap: ImageBitmap; params: CVParams }>) => {
  const { bitmap } = e.data;
  const off = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = off.getContext('2d');
  if (!ctx) {
    (self as any).postMessage({ edge: null });
    return;
  }
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, off.width, off.height);
  // Echo back grayscale magnitude of green channel as a trivial edge proxy
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < off.width * off.height; i++) {
    const g = img.data[i * 4 + 1];
    out[i * 4 + 0] = g;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = g;
    out[i * 4 + 3] = 255;
  }
  (self as any).postMessage({ edge: out.buffer, width: off.width, height: off.height }, [out.buffer]);
};


