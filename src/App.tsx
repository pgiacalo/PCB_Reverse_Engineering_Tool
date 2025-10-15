import React, { useState, useRef, useCallback } from 'react';
import { Upload, Eye, EyeOff, ZoomIn, ZoomOut, Palette, Eraser, Download, Move, RotateCw, Scale, Target } from 'lucide-react';
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
  const [brushSize, setBrushSize] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const [selectedImageForTransform, setSelectedImageForTransform] = useState<'top' | 'bottom' | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformStartPos, setTransformStartPos] = useState<{ x: number; y: number } | null>(null);
  const [transformMode, setTransformMode] = useState<'nudge' | 'scale' | 'rotate'>('nudge');
  const [isGrayscale, setIsGrayscale] = useState(false);

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

    if (currentTool === 'draw' || currentTool === 'erase') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    } else if (currentTool === 'transform' && selectedImageForTransform) {
      setIsTransforming(true);
      setTransformStartPos({ x, y });
    }
  }, [currentTool, selectedImageForTransform]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing && currentStroke.length > 0) {
      setCurrentStroke(prev => [...prev, { x, y }]);
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
  }, [isDrawing, currentStroke, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isDrawing && currentStroke.length > 0) {
      const newStroke: DrawingStroke = {
        id: Date.now().toString(),
        points: currentStroke,
        color: currentTool === 'erase' ? '#ffffff' : brushColor,
        size: brushSize,
        layer: currentView === 'top' ? 'top' : 'bottom',
      };
      setDrawingStrokes(prev => [...prev, newStroke]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
    setIsTransforming(false);
    setTransformStartPos(null);
  }, [isDrawing, currentStroke, currentTool, brushColor, brushSize, currentView]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw images with transformations
    if (topImage && (currentView === 'top' || currentView === 'overlay')) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = 1;
        
        // Apply grayscale filter if enabled
        if (isGrayscale) {
          ctx.filter = 'grayscale(100%)';
        }
        
        // Apply transformations
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.translate(centerX + topImage.x, centerY + topImage.y);
        ctx.rotate((topImage.rotation * Math.PI) / 180);
        ctx.scale(topImage.scale * (topImage.flipX ? -1 : 1), topImage.scale * (topImage.flipY ? -1 : 1));
        
        const scaledWidth = img.width * topImage.scale;
        const scaledHeight = img.height * topImage.scale;
        ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        ctx.restore();
        
        if (currentView === 'top') {
          drawStrokes(ctx);
        }
      };
      img.src = topImage.url;
    }

    if (bottomImage && (currentView === 'bottom' || currentView === 'overlay')) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = currentView === 'overlay' ? (transparency / 100) : 1;
        
        // Apply grayscale filter if enabled
        if (isGrayscale) {
          ctx.filter = 'grayscale(100%)';
        }
        
        // Apply transformations
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.translate(centerX + bottomImage.x, centerY + bottomImage.y);
        ctx.rotate((bottomImage.rotation * Math.PI) / 180);
        ctx.scale(bottomImage.scale * (bottomImage.flipX ? -1 : 1), bottomImage.scale * (bottomImage.flipY ? -1 : 1));
        
        const scaledWidth = img.width * bottomImage.scale;
        const scaledHeight = img.height * bottomImage.scale;
        ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        ctx.restore();
        
        if (currentView === 'bottom') {
          drawStrokes(ctx);
        }
      };
      img.src = bottomImage.url;
    }

    if (currentView === 'overlay' && topImage) {
      drawStrokes(ctx);
    }
  }, [topImage, bottomImage, currentView, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale]);

  const drawStrokes = (ctx: CanvasRenderingContext2D) => {
    drawingStrokes.forEach(stroke => {
      if (stroke.layer === currentView || currentView === 'overlay') {
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

    // Draw current stroke
    if (currentStroke.length > 0) {
      ctx.strokeStyle = currentTool === 'erase' ? '#ffffff' : brushColor;
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
        // Scaling: 1% changes
        let scaleDelta = 0;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            scaleDelta = 0.01; // Increase by 1%
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            scaleDelta = -0.01; // Decrease by 1%
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
        // Rotation: 1 degree changes
        let rotationDelta = 0;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            rotationDelta = 1; // Increase by 1 degree
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            rotationDelta = -1; // Decrease by 1 degree
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
      if (target.tagName === 'INPUT' && target.type === 'range') {
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

            <div className="radio-group compact">
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
                    onClick={() => setIsGrayscale(!isGrayscale)}
                    className={`grayscale-button ${isGrayscale ? 'active' : ''}`}
                  >
                    {isGrayscale ? 'Color Mode' : 'Grayscale Mode'}
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
                className={currentTool === 'erase' ? 'active' : ''}
                title="Eraser tool"
              >
                <Eraser size={14} />
                Erase
              </button>
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
                Color
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