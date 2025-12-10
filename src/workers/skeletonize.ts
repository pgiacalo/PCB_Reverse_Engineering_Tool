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

// Zhang–Suen thinning (skeletonization) on a binary image
// Expects RGBA ImageData where edge pixels are white (255) and background black (0)
// Returns RGBA ImageData of same size with thinned skeleton in white

export {};

type InMsg = {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
};

type OutMsg = {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
};

const toBinary = (data: Uint8ClampedArray, width: number, height: number): Uint8Array => {
  const bin = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const v = data[i * 4]; // R channel (edges are white)
    bin[i] = v > 0 ? 1 : 0;
  }
  return bin;
};

const fromBinary = (bin: Uint8Array, width: number, height: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = bin[i] ? 255 : 0;
    const o = i * 4;
    out[o + 0] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
};

const idx = (x: number, y: number, w: number) => y * w + x;

const zhangSuen = (src: Uint8Array, width: number, height: number): Uint8Array => {
  const img = src.slice();
  let changed = true;
  const neighbors = (x: number, y: number, arr: Uint8Array) => {
    // P2..P9 in clockwise order starting from north
    return [
      arr[idx(x, y - 1, width)], // P2
      arr[idx(x + 1, y - 1, width)], // P3
      arr[idx(x + 1, y, width)], // P4
      arr[idx(x + 1, y + 1, width)], // P5
      arr[idx(x, y + 1, width)], // P6
      arr[idx(x - 1, y + 1, width)], // P7
      arr[idx(x - 1, y, width)], // P8
      arr[idx(x - 1, y - 1, width)], // P9
    ];
  };

  const Acount = (nb: number[]) => {
    let a = 0;
    for (let i = 0; i < 8; i++) {
      const curr = nb[i];
      const next = nb[(i + 1) % 8];
      if (curr === 0 && next === 1) a++;
    }
    return a;
  };

  const Bcount = (nb: number[]) => nb.reduce((s, v) => s + (v ? 1 : 0), 0);

  while (changed) {
    changed = false;
    const toRemove1: number[] = [];

    // Sub-iteration 1
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p1 = img[idx(x, y, width)];
        if (p1 !== 1) continue;
        const nb = neighbors(x, y, img);
        const A = Acount(nb as any);
        const B = Bcount(nb as any);
        const p2 = nb[0];
        const p4 = nb[2];
        const p6 = nb[4];
        const p8 = nb[6];
        if (
          B >= 2 && B <= 6 &&
          A === 1 &&
          (p2 * p4 * p6 === 0) &&
          (p4 * p6 * p8 === 0)
        ) {
          toRemove1.push(idx(x, y, width));
        }
      }
    }
    if (toRemove1.length) changed = true;
    for (const i of toRemove1) img[i] = 0;

    const toRemove2: number[] = [];
    // Sub-iteration 2
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p1 = img[idx(x, y, width)];
        if (p1 !== 1) continue;
        const nb = neighbors(x, y, img);
        const A = Acount(nb as any);
        const B = Bcount(nb as any);
        const p2 = nb[0];
        const p4 = nb[2];
        const p6 = nb[4];
        const p8 = nb[6];
        if (
          B >= 2 && B <= 6 &&
          A === 1 &&
          (p2 * p4 * p8 === 0) &&
          (p2 * p6 * p8 === 0)
        ) {
          toRemove2.push(idx(x, y, width));
        }
      }
    }
    if (toRemove2.length) changed = true;
    for (const i of toRemove2) img[i] = 0;
  }

  return img;
};

self.onmessage = (e: MessageEvent<InMsg>) => {
  const { width, height, data } = e.data;
  // Convert RGBA to binary mask
  const bin = toBinary(data, width, height);
  // Run thinning
  const skel = zhangSuen(bin, width, height);
  // Convert back to RGBA
  const out = fromBinary(skel, width, height);
  const msg: OutMsg = { width, height, data: out };
  // Post back result
  (self as any).postMessage(msg, [msg.data.buffer]);
};


