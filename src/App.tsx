import React, { useState, useRef, useCallback } from 'react';
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
type Tool = 'draw' | 'erase' | 'transform';

function App() {
  const [topImage, setTopImage] = useState<PCBImage | null>(null);
  const [bottomImage, setBottomImage] = useState<PCBImage | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('overlay');
  const [transparency, setTransparency] = useState(50);
  const [currentTool, setCurrentTool] = useState<Tool>('draw');
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);

  const handleImageLoad = useCallback((file: File, type: 'top' | 'bottom') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const imageData: PCBImage = {
          url: e.target?.result as string,
          name: file.name,
          width: img.width,
          height: img.height,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          flipX: false,
          flipY: false,
        };
        
        if (type === 'top') {
          setTopImage(imageData);
        } else {
          setBottomImage(imageData);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'draw') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    } else if (currentTool === 'erase') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
      console.log('Starting erase at:', x, y, 'selectedDrawingLayer:', selectedDrawingLayer, 'total strokes:', drawingStrokes.length);
    } else if (currentTool === 'transform' && selectedImageForTransform) {
      setIsTransforming(true);
      setTransformStartPos({ x, y });
    }
  }, [currentTool, selectedImageForTransform, brushSize, selectedDrawingLayer, drawingStrokes.length]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing && currentStroke.length > 0) {
      setCurrentStroke(prev => [...prev, { x, y }]);
      
      // For erasing, check if we're intersecting with any strokes and remove them
      if (currentTool === 'erase') {
        setDrawingStrokes(prev => {
          const filtered = prev.filter(stroke => {
            // Only check strokes on the selected drawing layer
            if (stroke.layer !== selectedDrawingLayer) return true;
            
            // Check if any point in the stroke is within the eraser radius
            const hasIntersection = stroke.points.some(point => {
              const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
              return distance <= brushSize; // Use full brush size for more forgiving erasing
            });
            
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
  }, [isDrawing, currentStroke, currentTool, brushSize, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage]);

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
  }, [isDrawing, currentStroke, currentTool, brushColor, brushSize, selectedDrawingLayer]);


  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Helper to create an edge-detected (black & white) canvas from an image
    const createEdgeCanvas = (image: HTMLImageElement, invert: boolean): HTMLCanvasElement => {
      const w = image.width;
      const h = image.height;
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const octx = offscreen.getContext('2d');
      if (!octx) return offscreen;
      octx.drawImage(image, 0, 0, w, h);
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

    // Draw images with transformations
    if (topImage && (currentView === 'top' || currentView === 'overlay')) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = 1;
        // Apply grayscale filter if enabled and not in edge mode
        if (isGrayscale && !isBlackAndWhiteEdges) {
          ctx.filter = 'grayscale(100%)';
        } else {
          ctx.filter = 'none';
        }
        
        // Apply transformations
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.translate(centerX + topImage.x, centerY + topImage.y);
        ctx.rotate((topImage.rotation * Math.PI) / 180);
        ctx.scale(topImage.scale * (topImage.flipX ? -1 : 1), topImage.scale * (topImage.flipY ? -1 : 1));
        
        const scaledWidth = img.width * topImage.scale;
        const scaledHeight = img.height * topImage.scale;
        if (isBlackAndWhiteEdges) {
          const edgeCanvas = createEdgeCanvas(img, isBlackAndWhiteInverted);
          ctx.drawImage(edgeCanvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        } else {
          ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        }
        ctx.restore();
        
        // Draw strokes after image is loaded
        drawStrokes(ctx);
      };
      img.src = topImage.url;
    }

    if (bottomImage && (currentView === 'bottom' || currentView === 'overlay')) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = currentView === 'overlay' ? (transparency / 100) : 1;
        // Apply grayscale filter if enabled and not in edge mode
        if (isGrayscale && !isBlackAndWhiteEdges) {
          ctx.filter = 'grayscale(100%)';
        } else {
          ctx.filter = 'none';
        }
        
        // Apply transformations
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.translate(centerX + bottomImage.x, centerY + bottomImage.y);
        ctx.rotate((bottomImage.rotation * Math.PI) / 180);
        ctx.scale(bottomImage.scale * (bottomImage.flipX ? -1 : 1), bottomImage.scale * (bottomImage.flipY ? -1 : 1));
        
        const scaledWidth = img.width * bottomImage.scale;
        const scaledHeight = img.height * bottomImage.scale;
        if (isBlackAndWhiteEdges) {
          const edgeCanvas = createEdgeCanvas(img, isBlackAndWhiteInverted);
          ctx.drawImage(edgeCanvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        } else {
          ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        }
        ctx.restore();
        
        // Draw strokes after image is loaded
        drawStrokes(ctx);
      };
      img.src = bottomImage.url;
    }

    // If no images are loaded, still draw strokes
    if (!topImage && !bottomImage) {
      drawStrokes(ctx);
    }
  }, [topImage, bottomImage, currentView, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale, isBlackAndWhiteEdges, isBlackAndWhiteInverted, selectedImageForTransform, selectedDrawingLayer, showBothLayers]);

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
      e.preventDefault(); // Prevent page scrolling

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
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔧 PCB Reverse Engineering Tool</h1>
      </header>

      <div className="main-container">
        {/* Control Panel */}
        <div className="control-panel">
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
                onClick={() => setCurrentView(currentView === 'top' ? 'overlay' : 'top')}
                className={currentView === 'top' ? 'active' : ''}
              >
                Top
              </button>
              <button 
                onClick={() => setCurrentView(currentView === 'bottom' ? 'overlay' : 'bottom')}
                className={currentView === 'bottom' ? 'active' : ''}
              >
                Bottom
              </button>
              <button 
                onClick={() => setCurrentView(currentView === 'overlay' ? 'top' : 'overlay')}
                className={currentView === 'overlay' ? 'active' : ''}
              >
                Overlay
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
                onClick={() => setCurrentTool(currentTool === 'draw' ? 'draw' : 'draw')}
                className={currentTool === 'draw' ? 'active' : ''}
                title="Draw tool"
              >
                <Palette size={14} />
                Draw
              </button>
              <button 
                onClick={() => setCurrentTool(currentTool === 'erase' ? 'draw' : 'erase')}
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

        {/* Canvas Area */}
        <div className="canvas-container">
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
        </div>
      </div>
    </div>
  );
}

export default App;