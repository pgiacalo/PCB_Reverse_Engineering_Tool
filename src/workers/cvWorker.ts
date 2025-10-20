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


