import React, { useState, useRef, useCallback } from 'react';
import { rectTransformedBounds, mergeBounds, type Bounds } from './utils/geometry';
import { Palette, Eraser, Move } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import './App.css';

interface PCBImage {
  url: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  bitmap?: ImageBitmap | null;
}

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  layer: 'top' | 'bottom';
}

type ViewMode = 'top' | 'bottom' | 'overlay';
type Tool = 'none' | 'draw' | 'erase' | 'transform' | 'magnify';

function App() {
  const [topImage, setTopImage] = useState<PCBImage | null>(null);
  const [bottomImage, setBottomImage] = useState<PCBImage | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('overlay');
  const [transparency, setTransparency] = useState(50);
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(10);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const [selectedImageForTransform, setSelectedImageForTransform] = useState<'top' | 'bottom' | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformStartPos, setTransformStartPos] = useState<{ x: number; y: number } | null>(null);
  const [transformMode, setTransformMode] = useState<'nudge' | 'scale' | 'rotate'>('nudge');
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [isBlackAndWhiteEdges, setIsBlackAndWhiteEdges] = useState(false);
  const [isBlackAndWhiteInverted, setIsBlackAndWhiteInverted] = useState(false);
  const [selectedDrawingLayer, setSelectedDrawingLayer] = useState<'top' | 'bottom'>('top');
  const [showBothLayers, setShowBothLayers] = useState(false);
  const [isShiftConstrained, setIsShiftConstrained] = useState(false);
  const [viewScale, setViewScale] = useState(1);
  const [viewPan, setViewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const vScrollRef = useRef<HTMLDivElement>(null);
  const hScrollContentRef = useRef<HTMLDivElement>(null);
  const vScrollContentRef = useRef<HTMLDivElement>(null);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = useCallback(async (file: File, type: 'top' | 'bottom') => {
    try {
      const bitmap = await createImageBitmap(file);
      const url = URL.createObjectURL(file);
      const imageData: PCBImage = {
        url,
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
        bitmap,
      };
      if (type === 'top') {
        setTopImage(imageData);
      } else {
        setBottomImage(imageData);
      }
    } catch (err) {
      console.error('Failed to load image', err);
    }
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = screenX * scaleX;
    const canvasY = screenY * scaleY;
    const x = (canvasX - viewPan.x) / viewScale;
    const y = (canvasY - viewPan.y) / viewScale;

    if (currentTool === 'magnify') {
      const factor = e.shiftKey ? 0.5 : 2;
      const newScale = Math.max(0.25, Math.min(8, viewScale * factor));
      // Keep clicked world point under cursor after zoom: pan' = canvasPt - newScale * world
      const newPanX = canvasX - newScale * x;
      const newPanY = canvasY - newScale * y;
      setViewScale(newScale);
      setViewPan({ x: newPanX, y: newPanY });
      return;
    } else if (currentTool === 'draw') {
      setIsDrawing(true);
      setIsShiftConstrained(e.shiftKey === true);
      setCurrentStroke([{ x, y }]);
    } else if (currentTool === 'erase') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
      console.log('Starting erase at:', x, y, 'selectedDrawingLayer:', selectedDrawingLayer, 'total strokes:', drawingStrokes.length);
    } else if (currentTool === 'transform' && selectedImageForTransform) {
      setIsTransforming(true);
      setTransformStartPos({ x, y });
    }
  }, [currentTool, selectedImageForTransform, brushSize, selectedDrawingLayer, drawingStrokes.length, viewScale, viewPan.x, viewPan.y]);

  const snapConstrainedPoint = useCallback((start: DrawingPoint, x: number, y: number): DrawingPoint => {
    const dx = x - start.x;
    const dy = y - start.y;
    if (dx === 0 && dy === 0) return { x, y };
    // Determine nearest orientation among 0°, 45°, 90° based on initial direction
    const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
    const abs180 = ((angle % 180) + 180) % 180; // 0..180
    // Nearest among 0,45,90
    const candidates = [0, 45, 90];
    let best = 0;
    let bestDiff = 1e9;
    for (const c of candidates) {
      const d = Math.abs(abs180 - c);
      if (d < bestDiff) { bestDiff = d; best = c; }
    }
    if (best === 0) {
      // Horizontal
      return { x, y: start.y };
    } else if (best === 90) {
      // Vertical
      return { x: start.x, y };
    } else {
      // 45°: choose +45 vs -45 by sign of dx,dy
      const mag = Math.min(Math.abs(dx), Math.abs(dy));
      const sx = dx >= 0 ? 1 : -1;
      const sy = dy >= 0 ? 1 : -1;
      return { x: start.x + sx * mag, y: start.y + sy * mag };
    }
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = screenX * scaleX;
    const canvasY = screenY * scaleY;
    const x = (canvasX - viewPan.x) / viewScale;
    const y = (canvasY - viewPan.y) / viewScale;

    if (isDrawing && currentStroke.length > 0) {
      if (currentTool === 'draw') {
        if (isShiftConstrained) {
          const startPt = currentStroke[0];
          const snapped = snapConstrainedPoint(startPt, x, y);
          setCurrentStroke([startPt, snapped]);
        } else {
          setCurrentStroke(prev => [...prev, { x, y }]);
        }
      } else if (currentTool === 'erase') {
        setCurrentStroke(prev => [...prev, { x, y }]);
        setDrawingStrokes(prev => {
          const filtered = prev.filter(stroke => {
            // Only check strokes on the selected drawing layer
            if (stroke.layer !== selectedDrawingLayer) return true;
            
            // Check distance from the eraser center to each segment of the stroke polyline
            const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
              const dx = x2 - x1;
              const dy = y2 - y1;
              const lenSq = dx * dx + dy * dy;
              if (lenSq === 0) {
                // Degenerate segment; treat as a point
                const ddx = px - x1;
                const ddy = py - y1;
                return Math.sqrt(ddx * ddx + ddy * ddy);
              }
              // Project point onto segment, clamped to [0,1]
              const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
              const projX = x1 + t * dx;
              const projY = y1 + t * dy;
              const ddx = px - projX;
              const ddy = py - projY;
              return Math.sqrt(ddx * ddx + ddy * ddy);
            };

            let hasIntersection = false;
            if (stroke.points.length === 1) {
              const p0 = stroke.points[0];
              hasIntersection = Math.hypot(p0.x - x, p0.y - y) <= brushSize;
            } else {
              for (let i = 0; i < stroke.points.length - 1; i++) {
                const p1 = stroke.points[i];
                const p2 = stroke.points[i + 1];
                const d = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
                if (d <= brushSize) { hasIntersection = true; break; }
              }
            }
            
            if (hasIntersection) {
              console.log('Erasing stroke at position:', x, y, 'brushSize:', brushSize, 'selectedLayer:', selectedDrawingLayer);
            }
            
            return !hasIntersection;
          });
          
          console.log('Strokes before:', prev.length, 'after:', filtered.length);
          return filtered;
        });
      }
    } else if (isTransforming && transformStartPos && selectedImageForTransform) {
      const deltaX = x - transformStartPos.x;
      const deltaY = y - transformStartPos.y;
      
      if (selectedImageForTransform === 'top' && topImage) {
        setTopImage(prev => prev ? {
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY
        } : null);
      } else if (selectedImageForTransform === 'bottom' && bottomImage) {
        setBottomImage(prev => prev ? {
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY
        } : null);
      }
      
      setTransformStartPos({ x, y });
    }
  }, [isDrawing, currentStroke, currentTool, brushSize, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage, isShiftConstrained, snapConstrainedPoint, selectedDrawingLayer, setDrawingStrokes, viewScale, viewPan.x, viewPan.y]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isDrawing && currentStroke.length > 0) {
      if (currentTool === 'draw') {
        // For drawing, store the stroke normally
        const newStroke: DrawingStroke = {
          id: Date.now().toString(),
          points: currentStroke,
          color: brushColor,
          size: brushSize,
          layer: selectedDrawingLayer,
        };
        setDrawingStrokes(prev => [...prev, newStroke]);
      }
      // For erasing, we don't store the stroke - it directly removes other strokes
      setCurrentStroke([]);
    }
    setIsDrawing(false);
    setIsTransforming(false);
    setTransformStartPos(null);
    setIsShiftConstrained(false);
  }, [isDrawing, currentStroke, currentTool, brushColor, brushSize, selectedDrawingLayer]);


  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply global view transform once (pan then scale)
    ctx.save();
    ctx.translate(viewPan.x, viewPan.y);
    ctx.scale(viewScale, viewScale);

    // Helper to create an edge-detected (black & white) canvas from a CanvasImageSource
    const createEdgeCanvas = (source: CanvasImageSource, invert: boolean): HTMLCanvasElement => {
      const w = (source as any).width as number;
      const h = (source as any).height as number;
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const octx = offscreen.getContext('2d');
      if (!octx) return offscreen;
      octx.drawImage(source, 0, 0, w, h);
      const srcData = octx.getImageData(0, 0, w, h);
      const src = srcData.data;

      // Convert to grayscale luminance
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0; i < w * h; i++) {
        const r = src[i * 4 + 0];
        const g = src[i * 4 + 1];
        const b = src[i * 4 + 2];
        // luminance (rounded)
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      const gxKernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gyKernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
      const mag = new Float32Array(w * h);

      // Convolution (Sobel)
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let gx = 0;
          let gy = 0;
          let k = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ix = x + kx;
              const iy = y + ky;
              const val = gray[iy * w + ix];
              gx += val * gxKernel[k];
              gy += val * gyKernel[k];
              k++;
            }
          }
          const m = Math.sqrt(gx * gx + gy * gy);
          mag[y * w + x] = m;
        }
      }

      // Normalize and threshold
      let maxVal = 0;
      for (let i = 0; i < mag.length; i++) {
        if (mag[i] > maxVal) maxVal = mag[i];
      }
      const outData = octx.createImageData(w, h);
      const out = outData.data;
      const threshold = 0.20; // keep stronger edges (20% of max)
      for (let i = 0; i < w * h; i++) {
        const normalized = maxVal > 0 ? mag[i] / maxVal : 0;
        const edge = normalized >= threshold ? 255 : 0; // white edges on black background
        const value = invert ? 255 - edge : edge;
        out[i * 4 + 0] = value;
        out[i * 4 + 1] = value;
        out[i * 4 + 2] = value;
        out[i * 4 + 3] = 255;
      }
      octx.putImageData(outData, 0, 0);
      return offscreen;
    };

    // Draw images with transformations and apply view transform per draw
    if (topImage && topImage.bitmap && (currentView === 'top' || currentView === 'overlay')) {
      const bmp = topImage.bitmap;
      ctx.save();
      ctx.globalAlpha = 1;
      // Apply grayscale filter if enabled and not in edge mode
      if (isGrayscale && !isBlackAndWhiteEdges) {
        ctx.filter = 'grayscale(100%)';
      } else {
        ctx.filter = 'none';
      }
      // Apply per-image transformations
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.translate(centerX + topImage.x, centerY + topImage.y);
      ctx.rotate((topImage.rotation * Math.PI) / 180);
      ctx.scale(topImage.scale * (topImage.flipX ? -1 : 1), topImage.scale * (topImage.flipY ? -1 : 1));
      const scaledWidth = bmp.width * 1; // already accounted by ctx.scale above
      const scaledHeight = bmp.height * 1;
      if (isBlackAndWhiteEdges) {
        const edgeCanvas = createEdgeCanvas(bmp, isBlackAndWhiteInverted);
        ctx.drawImage(edgeCanvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      } else {
        ctx.drawImage(bmp, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    if (bottomImage && bottomImage.bitmap && (currentView === 'bottom' || currentView === 'overlay')) {
      const bmp = bottomImage.bitmap;
      ctx.save();
      ctx.globalAlpha = currentView === 'overlay' ? (transparency / 100) : 1;
      if (isGrayscale && !isBlackAndWhiteEdges) {
        ctx.filter = 'grayscale(100%)';
      } else {
        ctx.filter = 'none';
      }
      // Apply per-image transformations
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.translate(centerX + bottomImage.x, centerY + bottomImage.y);
      ctx.rotate((bottomImage.rotation * Math.PI) / 180);
      ctx.scale(bottomImage.scale * (bottomImage.flipX ? -1 : 1), bottomImage.scale * (bottomImage.flipY ? -1 : 1));
      const scaledWidth = bmp.width * 1;
      const scaledHeight = bmp.height * 1;
      if (isBlackAndWhiteEdges) {
        const edgeCanvas = createEdgeCanvas(bmp, isBlackAndWhiteInverted);
        ctx.drawImage(edgeCanvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      } else {
        ctx.drawImage(bmp, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    // Always draw strokes on top (respecting view transform applied above)
    drawStrokes(ctx);
    // Restore after view scaling
    ctx.restore();
  }, [topImage, bottomImage, currentView, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale, isBlackAndWhiteEdges, isBlackAndWhiteInverted, selectedImageForTransform, selectedDrawingLayer, showBothLayers, viewScale, viewPan.x, viewPan.y]);

  // Resize scrollbar extents based on transformed image bounds
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const hContent = hScrollContentRef.current;
    const vContent = vScrollContentRef.current;
    if (!canvas || !container || !hContent || !vContent) return;

    let bounds: Bounds | null = null;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const addImageBounds = (img: typeof topImage | typeof bottomImage) => {
      if (!img || !img.bitmap) return;
      const scaleX = img.scale * (img.flipX ? -1 : 1);
      const scaleY = img.scale * (img.flipY ? -1 : 1);
      const b = rectTransformedBounds(
        img.bitmap.width,
        img.bitmap.height,
        centerX,
        centerY,
        img.x,
        img.y,
        scaleX,
        scaleY,
        img.rotation
      );
      bounds = mergeBounds(bounds, b);
    };
    addImageBounds(topImage);
    addImageBounds(bottomImage);

    if (!bounds) {
      // No images; set minimal scroll extents
      hContent.style.width = `${container.clientWidth}px`;
      vContent.style.height = `${container.clientHeight}px`;
      return;
    }
    const nb = bounds as Bounds;
    const widthWorld = nb.maxX - nb.minX;
    const heightWorld = nb.maxY - nb.minY;
    const widthScreen = widthWorld * viewScale;
    const heightScreen = heightWorld * viewScale;

    const desiredW = Math.max(container.clientWidth, Math.ceil(widthScreen));
    const desiredH = Math.max(container.clientHeight, Math.ceil(heightScreen));
    hContent.style.width = `${desiredW}px`;
    vContent.style.height = `${desiredH}px`;
  }, [topImage, bottomImage, viewScale]);

  const drawStrokes = (ctx: CanvasRenderingContext2D) => {
    drawingStrokes.forEach(stroke => {
      // Show strokes based on current view, layer assignment, and visibility settings
      const shouldShowStroke = 
        (currentView === 'overlay' && 
         (showBothLayers || stroke.layer === selectedDrawingLayer)) ||
        (currentView === 'top' && stroke.layer === 'top' && (showBothLayers || selectedDrawingLayer === 'top')) ||
        (currentView === 'bottom' && stroke.layer === 'bottom' && (showBothLayers || selectedDrawingLayer === 'bottom'));
        
      if (shouldShowStroke) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 1;

        ctx.beginPath();
        stroke.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      }
    });

    // Draw current stroke if it's on the appropriate layer and visible
    if (currentStroke.length > 0) {
      const currentLayer = selectedDrawingLayer; // Use the selected drawing layer
      const shouldShowCurrentStroke = 
        (currentView === 'overlay' && 
         (showBothLayers || currentLayer === selectedDrawingLayer)) ||
        (currentView === 'top' && currentLayer === 'top' && (showBothLayers || selectedDrawingLayer === 'top')) ||
        (currentView === 'bottom' && currentLayer === 'bottom' && (showBothLayers || selectedDrawingLayer === 'bottom'));
        
      if (shouldShowCurrentStroke) {
        if (currentTool === 'draw') {
          ctx.strokeStyle = brushColor;
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 1;

          ctx.beginPath();
          currentStroke.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
        } else if (currentTool === 'erase') {
          // Show eraser path as a semi-transparent red line
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 0.5;

          ctx.beginPath();
          currentStroke.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
        }
      }
    }
  };

  // Transformation functions
  const updateImageTransform = useCallback((type: 'top' | 'bottom', updates: Partial<PCBImage>) => {
    if (type === 'top' && topImage) {
      setTopImage(prev => prev ? { ...prev, ...updates } : null);
    } else if (type === 'bottom' && bottomImage) {
      setBottomImage(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [topImage, bottomImage]);

  const resetImageTransform = useCallback(() => {
    // Reset both images to their original state
    if (topImage) {
      updateImageTransform('top', { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
    }
    if (bottomImage) {
      updateImageTransform('bottom', { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
    }
    // Also restore color mode
    setIsGrayscale(false);
    setIsBlackAndWhiteEdges(false);
    setIsBlackAndWhiteInverted(false);
  }, [updateImageTransform, topImage, bottomImage]);

  // Enhanced keyboard functionality for sliders and image transformation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if we're in transform mode with an image selected
    if (currentTool === 'transform' && selectedImageForTransform) {
      // Prevent default and stop propagation early so focused radios/sliders don't consume arrows
      e.preventDefault();
      e.stopPropagation();

      // If a radio input has focus, blur it so arrows won't switch selection
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'INPUT') {
        const input = active as HTMLInputElement;
        if (input.type === 'radio') {
          input.blur();
        }
      }

      if (transformMode === 'nudge') {
        // Nudging: single pixel movement
        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
          case 'ArrowLeft':
            deltaX = -1;
            break;
          case 'ArrowRight':
            deltaX = 1;
            break;
          case 'ArrowUp':
            deltaY = -1;
            break;
          case 'ArrowDown':
            deltaY = 1;
            break;
          default:
            return;
        }

        if (selectedImageForTransform === 'top' && topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        } else if (selectedImageForTransform === 'bottom' && bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        }
      } else if (transformMode === 'scale') {
        // Scaling: 1% for up/down, 0.1% for left/right
        let scaleDelta = 0;

        switch (e.key) {
          case 'ArrowUp':
            scaleDelta = 0.01; // Increase by 1%
            break;
          case 'ArrowDown':
            scaleDelta = -0.01; // Decrease by 1%
            break;
          case 'ArrowRight':
            scaleDelta = 0.001; // Increase by 0.1%
            break;
          case 'ArrowLeft':
            scaleDelta = -0.001; // Decrease by 0.1%
            break;
          default:
            return;
        }

        if (selectedImageForTransform === 'top' && topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
          } : null);
        } else if (selectedImageForTransform === 'bottom' && bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
          } : null);
        }
      } else if (transformMode === 'rotate') {
        // Rotation: 1 degree for up/down, 0.1 degree for left/right
        let rotationDelta = 0;

        switch (e.key) {
          case 'ArrowUp':
            rotationDelta = 1; // Increase by 1 degree
            break;
          case 'ArrowDown':
            rotationDelta = -1; // Decrease by 1 degree
            break;
          case 'ArrowRight':
            rotationDelta = 0.1; // Increase by 0.1 degree
            break;
          case 'ArrowLeft':
            rotationDelta = -0.1; // Decrease by 0.1 degree
            break;
          default:
            return;
        }

        if (selectedImageForTransform === 'top' && topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            rotation: prev.rotation + rotationDelta
          } : null);
        } else if (selectedImageForTransform === 'bottom' && bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            rotation: prev.rotation + rotationDelta
          } : null);
        }
      }
    } else {
      // Handle slider controls with arrow keys
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
        const slider = target as HTMLInputElement;
        const currentValue = Number(slider.value);
        const min = Number(slider.min);
        const max = Number(slider.max);
        const step = Number(slider.step) || 1;

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            const newValueLeft = Math.max(min, currentValue - step);
            slider.value = newValueLeft.toString();
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          case 'ArrowRight':
            e.preventDefault();
            const newValueRight = Math.min(max, currentValue + step);
            slider.value = newValueRight.toString();
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            break;
        }
      }
    }
  }, [currentTool, selectedImageForTransform, transformMode, topImage, bottomImage]);

  // Add keyboard event listener for arrow keys
  React.useEffect(() => {
    // Use capture to intercept before default handling on focused controls (e.g., radios)
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown]);

  // Double-click reset function for sliders
  const handleSliderDoubleClick = useCallback((sliderType: string) => {
    switch (sliderType) {
      case 'transparency':
        setTransparency(50);
        break;
      case 'brushSize':
        setBrushSize(3);
        break;
    }
  }, []);

  // Redraw canvas when dependencies change
  React.useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Force redraw when drawingStrokes change (for eraser)
  React.useEffect(() => {
    drawCanvas();
  }, [drawingStrokes]);

  // Keep scrollbars in sync with viewPan changes from other interactions
  React.useEffect(() => {
    const h = hScrollRef.current;
    if (h) {
      const maxX = Math.max(0, h.scrollWidth - h.clientWidth);
      const desired = Math.max(0, Math.min(maxX, -viewPan.x));
      if (Math.abs(h.scrollLeft - desired) > 1) h.scrollLeft = desired;
    }
    const v = vScrollRef.current;
    if (v) {
      const maxY = Math.max(0, v.scrollHeight - v.clientHeight);
      const desired = Math.max(0, Math.min(maxY, -viewPan.y));
      if (Math.abs(v.scrollTop - desired) > 1) v.scrollTop = desired;
    }
  }, [viewPan.x, viewPan.y]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔧 PCB Reverse Engineering Tool</h1>
      </header>

      <div className="main-container">
        {/* Control Panel */}
        <div className="control-panel">
          {/* Fixed Tips Panel at top of control panel */}
          <div className="help-panel" style={{ marginBottom: 12 }}>
            {(() => {
              let mode = '';
              const tips: string[] = [];
              // First priority: guide loading when either image is missing
              if (!topImage || !bottomImage) {
                mode = 'Load Images';
                tips.push('Click "Load Top PCB" and "Load Bottom PCB" to select photos.');
                tips.push('Then use View Controls and Image Transform to align them.');
              } else if (currentTool === 'magnify') {
                mode = 'Magnify';
                tips.push('Click on the image to zoom in.');
                tips.push('Hold Shift and click to zoom out.');
              } else if (currentTool === 'transform') {
                mode = `Transform → ${transformMode}${selectedImageForTransform ? ` (${selectedImageForTransform} image)` : ''}`;
                if (!selectedImageForTransform) {
                  tips.push('Select Top Image or Bottom Image to transform.');
                } else if (transformMode === 'nudge') {
                  tips.push('Use arrow keys to move by 1 pixel.');
                  tips.push('Click and drag to reposition for coarse moves.');
                } else if (transformMode === 'scale') {
                  tips.push('Arrow Up/Down: ±1% scale. Arrow Left/Right: ±0.1% scale.');
                } else if (transformMode === 'rotate') {
                  tips.push('Arrow Up/Down: ±1°. Arrow Left/Right: ±0.1°.');
                }
              } else if (currentTool === 'draw') {
                mode = `Draw (${selectedDrawingLayer} layer)`;
                tips.push('Click and drag to draw.');
                tips.push('Hold Shift while drawing to constrain to H/V/45°.');
              } else if (currentTool === 'erase') {
                mode = `Erase (${selectedDrawingLayer} layer)`;
                tips.push('Click and drag to erase; intersected strokes are removed.');
                tips.push('Double-click the Erase button to clear the selected layer.');
              } else {
                mode = 'View';
                tips.push('Use View Controls to switch Top/Bottom/Overlay or Magnify.');
              }
  return (
    <>
                  <div><strong>Mode:</strong> {mode}</div>
                  {tips.map((t, i) => (
                    <div key={i}>• {t}</div>
                  ))}
                </>
              );
            })()}
          </div>

          {/* Scrollable tools area */}
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)', padding: '0 8px' }}>
          <div className="control-section">
            <h3>📁 Load PCB Images</h3>
            <div className="button-group compact">
              <button 
                onClick={() => fileInputTopRef.current?.click()}
                className="load-button"
              >
                Load Top PCB
              </button>
              <button 
                onClick={() => fileInputBottomRef.current?.click()}
                className="load-button"
              >
                Load Bottom PCB
              </button>
            </div>
            <input
              ref={fileInputTopRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageLoad(e.target.files[0], 'top')}
              style={{ display: 'none' }}
            />
            <input
              ref={fileInputBottomRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageLoad(e.target.files[0], 'bottom')}
              style={{ display: 'none' }}
            />
          </div>

          <div className="control-section">
            <h3>👁️ View Controls</h3>
            <div className="button-group compact">
              <button 
                onClick={() => { setCurrentView('top'); setCurrentTool('draw'); }}
                className={currentView === 'top' ? 'active' : ''}
              >
                Top
              </button>
              <button 
                onClick={() => { setCurrentView('bottom'); setCurrentTool('draw'); }}
                className={currentView === 'bottom' ? 'active' : ''}
              >
                Bottom
              </button>
              <button 
                onClick={() => { setCurrentView('overlay'); setCurrentTool('draw'); }}
                className={currentView === 'overlay' ? 'active' : ''}
              >
                Overlay
              </button>
              <button 
                onClick={() => {
                  // Toggle magnify and ensure exclusivity among view controls
                  setCurrentTool(prev => (prev === 'magnify' ? 'draw' : 'magnify'));
                }}
                className={currentTool === 'magnify' ? 'active' : ''}
                title="Magnify: click canvas to zoom (Shift to zoom out)"
              >
                Magnify
              </button>
            </div>
            
            {currentView === 'overlay' && (
              <div className="slider-group">
                <label>Transparency: {transparency}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transparency}
                  onChange={(e) => setTransparency(Number(e.target.value))}
                  onDoubleClick={() => handleSliderDoubleClick('transparency')}
                  className="slider"
                />
              </div>
            )}
          </div>


          <div className="control-section">
            <h3>🔧 Image Transform</h3>
            <div className="button-group compact">
              <button 
                onClick={() => setCurrentTool('transform')}
                className={currentTool === 'transform' ? 'active' : ''}
                title="Transform tool"
              >
                <Move size={14} />
                Transform
              </button>
            </div>

            <div className="radio-group horizontal">
              <label className="radio-label">
                <input
                  type="radio"
                  name="transformImage"
                  value="top"
                  checked={selectedImageForTransform === 'top'}
                  onChange={() => setSelectedImageForTransform('top')}
                  disabled={!topImage}
                />
                <span>Top Image</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="transformImage"
                  value="bottom"
                  checked={selectedImageForTransform === 'bottom'}
                  onChange={() => setSelectedImageForTransform('bottom')}
                  disabled={!bottomImage}
                />
                <span>Bottom Image</span>
              </label>
            </div>

            {selectedImageForTransform && (
              <div className="radio-group horizontal">
                <div>
                  <label className="radio-label">
                    <input
                      type="checkbox"
                      checked={selectedImageForTransform === 'top' ? (topImage?.flipX || false) : (bottomImage?.flipX || false)}
                      onChange={(e) => updateImageTransform(selectedImageForTransform, { flipX: e.target.checked })}
                    />
                    <span>Horizontal Flip</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="checkbox"
                      checked={selectedImageForTransform === 'top' ? (topImage?.flipY || false) : (bottomImage?.flipY || false)}
                      onChange={(e) => updateImageTransform(selectedImageForTransform, { flipY: e.target.checked })}
                    />
                    <span>Vertical Flip</span>
                  </label>
                </div>
                
      <div>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="transformMode"
                      value="nudge"
                      checked={transformMode === 'nudge'}
                      onChange={() => setTransformMode('nudge')}
                    />
                    <span>Nudge</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="transformMode"
                      value="scale"
                      checked={transformMode === 'scale'}
                      onChange={() => setTransformMode('scale')}
                    />
                    <span>Scale</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="transformMode"
                      value="rotate"
                      checked={transformMode === 'rotate'}
                      onChange={() => setTransformMode('rotate')}
                    />
                    <span>Rotate</span>
                  </label>
                </div>
              </div>
            )}

            {selectedImageForTransform && (
              <>



              <div className="button-group">
                  <button 
                    onClick={() => {
                      if (isGrayscale || isBlackAndWhiteEdges) {
                        // Revert to full color from grayscale or edge mode
                        setIsGrayscale(false);
                        setIsBlackAndWhiteEdges(false);
                        setIsBlackAndWhiteInverted(false);
                      } else {
                        // Enter grayscale mode
                        setIsGrayscale(true);
                      }
                    }}
                    className={`grayscale-button ${(isGrayscale || isBlackAndWhiteEdges) ? 'active' : ''}`}
                  >
                    {(isGrayscale || isBlackAndWhiteEdges) ? 'Color Mode' : 'Grayscale Mode'}
                  </button>
                  <button 
                    onClick={() => {
                      if (!isBlackAndWhiteEdges) {
                        setIsBlackAndWhiteEdges(true);
                        setIsBlackAndWhiteInverted(false);
                      } else {
                        // Toggle inversion while staying in edge mode
                        setIsBlackAndWhiteInverted(prev => !prev);
                      }
                    }}
                    className={`grayscale-button ${isBlackAndWhiteEdges ? 'active' : ''}`}
                    title={isBlackAndWhiteEdges ? 'Invert edges' : 'Black & White edge highlight'}
                  >
                    {isBlackAndWhiteEdges ? 'Invert' : 'Black & White'}
                  </button>
                  <button 
                    onClick={resetImageTransform}
                    className="reset-button small"
                  >
                    Reset Transform
                  </button>
                </div>

              </>
            )}
          </div>

          <div className="control-section">
            <h3>✏️ Drawing Tools</h3>
            <div className="button-group compact">
              <button 
                onClick={() => setCurrentTool('draw')}
                className={currentTool === 'draw' ? 'active' : ''}
                title="Draw tool"
              >
                <Palette size={14} />
                Draw
              </button>
              <button 
                onClick={() => setCurrentTool('erase')}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDrawingStrokes(prev => prev.filter(stroke => stroke.layer !== selectedDrawingLayer));
                }}
                className={currentTool === 'erase' ? 'active' : ''}
                title="Eraser tool (double-click to clear selected layer)"
              >
                <Eraser size={14} />
                Erase
              </button>
            </div>

            <div className="radio-group horizontal">
              <label className="radio-label">
                <input
                  type="radio"
                  name="drawingLayer"
                  value="top"
                  checked={selectedDrawingLayer === 'top'}
                  onChange={() => setSelectedDrawingLayer('top')}
                />
                <span>Top Layer</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="drawingLayer"
                  value="bottom"
                  checked={selectedDrawingLayer === 'bottom'}
                  onChange={() => setSelectedDrawingLayer('bottom')}
                />
                <span>Bottom Layer</span>
              </label>
            </div>

            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="checkbox"
                  checked={showBothLayers}
                  onChange={(e) => setShowBothLayers(e.target.checked)}
                />
                <span>Show Both Layers</span>
              </label>
            </div>
            
            <div className="slider-group">
              <label>Brush Size: {brushSize}px</label>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                onDoubleClick={() => handleSliderDoubleClick('brushSize')}
                className="slider"
              />
      </div>

            <div className="color-picker-section">
              <button 
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="color-button"
                style={{ backgroundColor: brushColor }}
              >
                Color Picker
        </button>
              
              {showColorPicker && (
                <div className="color-picker-popup">
                  <HexColorPicker color={brushColor} onChange={setBrushColor} />
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-container" ref={canvasContainerRef}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className={`pcb-canvas ${currentTool === 'transform' ? 'transform-cursor' : currentTool === 'draw' ? 'draw-cursor' : currentTool === 'erase' ? 'erase-cursor' : 'default-cursor'}`}
          />
          
          {!topImage && !bottomImage && (
            <div className="placeholder">
              <p>📸 Load your PCB images to get started</p>
              <p>Click "Load Top PCB" and "Load Bottom PCB" buttons</p>
            </div>
          )}

          {/* Horizontal scrollbar (bottom) */}
          <div
            ref={hScrollRef}
            className="scrollbar-horizontal"
            onScroll={(e) => {
              const el = e.currentTarget;
              setViewPan((p) => ({ x: -el.scrollLeft, y: p.y }));
            }}
            aria-label="Horizontal pan"
          >
            <div className="scrollbar-horizontal-content" ref={hScrollContentRef} />
          </div>

          {/* Vertical scrollbar (right) */}
          <div
            ref={vScrollRef}
            className="scrollbar-vertical"
            onScroll={(e) => {
              const el = e.currentTarget;
              setViewPan((p) => ({ x: p.x, y: -el.scrollTop }));
            }}
            aria-label="Vertical pan"
          >
            <div className="scrollbar-vertical-content" ref={vScrollContentRef} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;