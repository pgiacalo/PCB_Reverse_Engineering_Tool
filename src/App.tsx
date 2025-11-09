import React, { useState, useRef, useCallback } from 'react';
import { rectTransformedBounds, mergeBounds, type Bounds } from './utils/geometry';
import { Move, PenLine, Droplet, MousePointer } from 'lucide-react';
import './App.css';

interface PCBImage {
  url: string;
  name: string;
  width: number;
  height: number;
  // Persistable image content for Save/Load (data URL)
  dataUrl?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  // Skew (keystone) angles in radians; applied as affine shear
  skewX?: number;
  skewY?: number;
  // Keystone (perspective-like taper) in radians for vertical and horizontal
  keystoneV?: number;
  keystoneH?: number;
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
  type?: 'trace' | 'via';
}

// Independent stacks for saved/managed drawing objects
interface Via {
  x: number;
  y: number;
  size: number;
  color: string;
}

interface TraceSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  size: number;
  color: string;
}

type ViewMode = 'top' | 'bottom' | 'overlay';
type Tool = 'none' | 'select' | 'draw' | 'erase' | 'transform' | 'magnify' | 'pan';

function App() {
  const CONTENT_BORDER = 40; // fixed border (in canvas pixels) where nothing is drawn
  const [topImage, setTopImage] = useState<PCBImage | null>(null);
  const [bottomImage, setBottomImage] = useState<PCBImage | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('overlay');
  const [transparency, setTransparency] = useState(50);
  const [isTransparencyCycling, setIsTransparencyCycling] = useState(false);
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
  const [transformMode, setTransformMode] = useState<'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone'>('nudge');
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [isBlackAndWhiteEdges, setIsBlackAndWhiteEdges] = useState(false);
  const [isBlackAndWhiteInverted, setIsBlackAndWhiteInverted] = useState(false);
  const [selectedDrawingLayer, setSelectedDrawingLayer] = useState<'top' | 'bottom'>('top');
  const [showBothLayers, setShowBothLayers] = useState(false);
  const [isShiftConstrained, setIsShiftConstrained] = useState(false);
  const [viewScale, setViewScale] = useState(1);
  const [viewPan, setViewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [drawingMode, setDrawingMode] = useState<'trace' | 'via'>('trace');
  const [canvasCursor, setCanvasCursor] = useState<string | undefined>(undefined);
  const [, setViaOrderTop] = useState<string[]>([]);
  const [, setViaOrderBottom] = useState<string[]>([]);
  const [, setTraceOrderTop] = useState<string[]>([]);
  const [, setTraceOrderBottom] = useState<string[]>([]);
  // Independent lists (stacks) derived from drawingStrokes
  const [viasTop, setViasTop] = useState<Via[]>([]);
  const [viasBottom, setViasBottom] = useState<Via[]>([]);
  const [tracesTop, setTracesTop] = useState<TraceSegment[]>([]);
  const [tracesBottom, setTracesBottom] = useState<TraceSegment[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<DrawingPoint[]>([]);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const vScrollRef = useRef<HTMLDivElement>(null);
  const hScrollContentRef = useRef<HTMLDivElement>(null);
  const vScrollContentRef = useRef<HTMLDivElement>(null);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);
  const openProjectRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const transparencyCycleRafRef = useRef<number | null>(null);
  const transparencyCycleStartRef = useRef<number | null>(null);
  const isSyncingScrollRef = useRef<boolean>(false);
  const contentOriginXRef = useRef<number>(0);
  const contentOriginYRef = useRef<number>(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startCX: number; startCY: number; panX: number; panY: number } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 960, height: 600 });
  const [openMenu, setOpenMenu] = useState<'file' | 'view' | 'transform' | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const topThumbRef = useRef<HTMLCanvasElement>(null);
  const bottomThumbRef = useRef<HTMLCanvasElement>(null);
  // Layer visibility toggles
  const [showTopImage, setShowTopImage] = useState(true);
  const [showBottomImage, setShowBottomImage] = useState(true);
  const [showViasLayer, setShowViasLayer] = useState(true);
  const [showTopTracesLayer, setShowTopTracesLayer] = useState(true);
  const [showBottomTracesLayer, setShowBottomTracesLayer] = useState(true);
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [selectRect, setSelectRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleImageLoad = useCallback(async (file: File, type: 'top' | 'bottom') => {
    try {
      const bitmap = await createImageBitmap(file);
      const url = URL.createObjectURL(file);
      // Also keep a persistable data URL for Save/Load
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const imageData: PCBImage = {
        url,
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
        dataUrl,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
        skewX: 0,
        skewY: 0,
        keystoneV: 0,
        keystoneH: 0,
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / rect.width;
    const dprY = canvas.height / rect.height;
    // Use offset within the element for robustness
    const offX = (e.nativeEvent as any).offsetX as number | undefined;
    const offY = (e.nativeEvent as any).offsetY as number | undefined;
    const cssX = typeof offX === 'number' ? offX : (e.clientX - rect.left);
    const cssY = typeof offY === 'number' ? offY : (e.clientY - rect.top);
    const canvasX = cssX * dprX;
    const canvasY = cssY * dprY;
    // Convert to content world coords (subtract fixed border first)
    const contentCanvasX = canvasX - CONTENT_BORDER;
    const contentCanvasY = canvasY - CONTENT_BORDER;
    const x = (contentCanvasX - viewPan.x) / viewScale;
    const y = (contentCanvasY - viewPan.y) / viewScale;

    if (currentTool === 'select') {
      setIsSelecting(true);
      setSelectStart({ x, y });
      setSelectRect({ x, y, width: 0, height: 0 });
      return;
    } else if (currentTool === 'magnify') {
      const factor = e.shiftKey ? 0.5 : 2;
      const newScale = Math.max(0.25, Math.min(8, viewScale * factor));
      // Keep clicked world point under cursor after zoom: pan' = canvasPt - newScale * world
      const newPanX = contentCanvasX - newScale * x;
      const newPanY = contentCanvasY - newScale * y;
      setViewScale(newScale);
      setViewPan({ x: newPanX, y: newPanY });
      return;
    } else if (currentTool === 'pan') {
      // Start panning in content-canvas coordinates
      panStartRef.current = { startCX: contentCanvasX, startCY: contentCanvasY, panX: viewPan.x, panY: viewPan.y };
      setIsPanning(true);
      return;
    } else if (currentTool === 'draw') {
      // Helper: snap to nearest VIA center when drawing traces
      const snapToNearestViaCenter = (wx: number, wy: number): { x: number; y: number } => {
        let bestDist = Infinity;
        let bestCenter: { x: number; y: number } | null = null;
        for (const s of drawingStrokes) {
          if (s.type !== 'via' || s.layer !== selectedDrawingLayer) continue;
          const c = s.points[0];
          const radius = s.size / 2;
          const d = Math.hypot(c.x - wx, c.y - wy);
          const threshold = Math.max(8 / viewScale, radius * 0.8);
          if (d <= threshold && d < bestDist) { bestDist = d; bestCenter = c; }
        }
        return bestCenter ?? { x: wx, y: wy };
      };

      if (drawingMode === 'via') {
        // Add a filled circle representing a via at click location
        const center = { x, y };
        const viaStroke: DrawingStroke = {
          id: `${Date.now()}-via`,
          points: [center],
          color: brushColor,
          size: brushSize,
          layer: selectedDrawingLayer,
          type: 'via',
        };
        setDrawingStrokes(prev => [...prev, viaStroke]);
        if (selectedDrawingLayer === 'top') {
          setViaOrderTop(prev => [...prev, viaStroke.id]);
        } else {
          setViaOrderBottom(prev => [...prev, viaStroke.id]);
        }
        return;
      }

      // Traces mode: connected segments by clicks, snapping to via centers
      const snapped = drawingMode === 'trace' ? snapToNearestViaCenter(x, y) : { x, y };
      setCurrentStroke(prev => (prev.length === 0 ? [snapped] : [...prev, snapped]));
      // Do not start drag drawing when in traces mode; use click-to-add points
      setIsDrawing(false);
      setIsShiftConstrained(false);
    } else if (currentTool === 'erase') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
      console.log('Starting erase at:', x, y, 'selectedDrawingLayer:', selectedDrawingLayer, 'total strokes:', drawingStrokes.length);
    } else if (currentTool === 'transform' && selectedImageForTransform) {
      setIsTransforming(true);
      setTransformStartPos({ x, y });
    }
  }, [currentTool, selectedImageForTransform, brushSize, brushColor, drawingMode, selectedDrawingLayer, drawingStrokes.length, viewScale, viewPan.x, viewPan.y]);

  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'magnify') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / rect.width;
    const dprY = canvas.height / rect.height;
    const offX = (e.nativeEvent as any).offsetX as number | undefined;
    const offY = (e.nativeEvent as any).offsetY as number | undefined;
    const cssX = typeof offX === 'number' ? offX : (e.clientX - rect.left);
    const cssY = typeof offY === 'number' ? offY : (e.clientY - rect.top);
    const canvasX = cssX * dprX;
    const canvasY = cssY * dprY;
    const worldX = ((canvasX - CONTENT_BORDER) - viewPan.x) / viewScale;
    const worldY = ((canvasY - CONTENT_BORDER) - viewPan.y) / viewScale;

    const stepIn = 1.2; // zoom in factor per wheel step
    const stepOut = 1 / stepIn;
    const factor = e.deltaY < 0 ? stepIn : stepOut;
    const newScale = Math.max(0.25, Math.min(8, viewScale * factor));
    const newPanX = (canvasX - CONTENT_BORDER) - newScale * worldX;
    const newPanY = (canvasY - CONTENT_BORDER) - newScale * worldY;
    setViewScale(newScale);
    setViewPan({ x: newPanX, y: newPanY });
  }, [currentTool, viewScale, viewPan.x, viewPan.y]);

  const handleCanvasDoubleClick = useCallback(() => {
    const pts = currentStrokeRef.current;
    if (currentTool === 'draw' && drawingMode === 'trace' && pts.length >= 2) {
      const newStroke: DrawingStroke = {
        id: `${Date.now()}-trace`,
        points: pts,
        color: brushColor,
        size: brushSize,
        layer: selectedDrawingLayer,
        type: 'trace',
      };
      setDrawingStrokes(prev => [...prev, newStroke]);
      if (selectedDrawingLayer === 'top') {
        setTraceOrderTop(prev => [...prev, newStroke.id]);
      } else {
        setTraceOrderBottom(prev => [...prev, newStroke.id]);
      }
      setCurrentStroke([]);
    }
  }, [currentTool, drawingMode, brushColor, brushSize, selectedDrawingLayer]);

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
    const contentCanvasX = canvasX - CONTENT_BORDER;
    const contentCanvasY = canvasY - CONTENT_BORDER;
    const x = (contentCanvasX - viewPan.x) / viewScale;
    const y = (contentCanvasY - viewPan.y) / viewScale;

    if (currentTool === 'select' && isSelecting && selectStart) {
      const sx = selectStart.x;
      const sy = selectStart.y;
      setSelectRect({ x: Math.min(sx, x), y: Math.min(sy, y), width: Math.abs(x - sx), height: Math.abs(y - sy) });
    } else if (currentTool === 'pan' && isPanning && panStartRef.current) {
      const { startCX, startCY, panX, panY } = panStartRef.current;
      const dx = contentCanvasX - startCX;
      const dy = contentCanvasY - startCY;
      setViewPan({ x: panX + dx, y: panY + dy });
    } else if (isDrawing && currentStroke.length > 0) {
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
            
            // Square eraser hit-test (axis-aligned)
            const half = brushSize / 2;
            const minX = x - half;
            const maxX = x + half;
            const minY = y - half;
            const maxY = y + half;

            const pointInSquare = (px: number, py: number) => (px >= minX && px <= maxX && py >= minY && py <= maxY);

            // Cohen–Sutherland line-rectangle intersection
            const segIntersectsSquare = (x1: number, y1: number, x2: number, y2: number) => {
              const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
              const outCode = (px: number, py: number) => {
                let code = INSIDE;
                if (px < minX) code |= LEFT;
                else if (px > maxX) code |= RIGHT;
                if (py < minY) code |= BOTTOM;
                else if (py > maxY) code |= TOP;
                return code;
              };
              let xA = x1, yA = y1, xB = x2, yB = y2;
              let codeA = outCode(xA, yA);
              let codeB = outCode(xB, yB);
              while (true) {
                if ((codeA | codeB) === 0) return true;       // both inside
                if ((codeA & codeB) !== 0) return false;      // share outside region
                const codeOut = codeA !== 0 ? codeA : codeB;
                let xI = 0, yI = 0;
                if (codeOut & TOP) {
                  xI = xA + (xB - xA) * (maxY - yA) / (yB - yA);
                  yI = maxY;
                } else if (codeOut & BOTTOM) {
                  xI = xA + (xB - xA) * (minY - yA) / (yB - yA);
                  yI = minY;
                } else if (codeOut & RIGHT) {
                  yI = yA + (yB - yA) * (maxX - xA) / (xB - xA);
                  xI = maxX;
                } else {
                  yI = yA + (yB - yA) * (minX - xA) / (xB - xA);
                  xI = minX;
                }
                if (codeOut === codeA) {
                  xA = xI; yA = yI; codeA = outCode(xA, yA);
                } else {
                  xB = xI; yB = yI; codeB = outCode(xB, yB);
                }
              }
            };

            let hasIntersection = false;
            if (stroke.points.length === 1) {
              const p0 = stroke.points[0];
              hasIntersection = pointInSquare(p0.x, p0.y);
            } else {
              for (let i = 0; i < stroke.points.length - 1; i++) {
                const p1 = stroke.points[i];
                const p2 = stroke.points[i + 1];
                if (segIntersectsSquare(p1.x, p1.y, p2.x, p2.y)) { hasIntersection = true; break; }
              }
            }
            
            if (hasIntersection) {
              console.log('Erasing stroke at position:', x, y, 'brushSize:', brushSize, 'selectedLayer:', selectedDrawingLayer);
            }
            
            return !hasIntersection;
          });
          
          console.log('Strokes before:', prev.length, 'after:', filtered.length);
          // Sync ordered lists with kept IDs
          const kept = new Set(filtered.map(s => s.id));
          setViaOrderTop(order => order.filter(id => kept.has(id)));
          setViaOrderBottom(order => order.filter(id => kept.has(id)));
          setTraceOrderTop(order => order.filter(id => kept.has(id)));
          setTraceOrderBottom(order => order.filter(id => kept.has(id)));
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
  }, [isDrawing, currentStroke, currentTool, brushSize, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage, isShiftConstrained, snapConstrainedPoint, selectedDrawingLayer, setDrawingStrokes, viewScale, viewPan.x, viewPan.y, isSelecting, selectStart]);

  const handleCanvasMouseUp = useCallback(() => {
    // Finalize selection if active
    if (currentTool === 'select' && isSelecting) {
      const rectSel = selectRect;
      const start = selectStart;
      setIsSelecting(false);
      setSelectStart(null);
      setSelectRect(null);
      if (rectSel && start) {
        const tiny = rectSel.width < 3 && rectSel.height < 3;
        const withinRect = (px: number, py: number) => {
          const minX = rectSel.x;
          const minY = rectSel.y;
          const maxX = rectSel.x + rectSel.width;
          const maxY = rectSel.y + rectSel.height;
          return px >= minX && px <= maxX && py >= minY && py <= maxY;
        };
        const segIntersectsRect = (x1: number, y1: number, x2: number, y2: number, minX: number, minY: number, maxX: number, maxY: number) => {
          const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
          const outCode = (px: number, py: number) => {
            let code = INSIDE;
            if (px < minX) code |= LEFT;
            else if (px > maxX) code |= RIGHT;
            if (py < minY) code |= BOTTOM;
            else if (py > maxY) code |= TOP;
            return code;
          };
          let xA = x1, yA = y1, xB = x2, yB = y2;
          let codeA = outCode(xA, yA);
          let codeB = outCode(xB, yB);
          while (true) {
            if ((codeA | codeB) === 0) return true;
            if ((codeA & codeB) !== 0) return false;
            const codeOut = codeA !== 0 ? codeA : codeB;
            let xI = 0, yI = 0;
            if (codeOut & TOP) {
              xI = xA + (xB - xA) * (maxY - yA) / (yB - yA);
              yI = maxY;
            } else if (codeOut & BOTTOM) {
              xI = xA + (xB - xA) * (minY - yA) / (yB - yA);
              yI = minY;
            } else if (codeOut & RIGHT) {
              yI = yA + (yB - yA) * (maxX - xA) / (xB - xA);
              xI = maxX;
            } else {
              yI = yA + (yB - yA) * (minX - xA) / (xB - xA);
              xI = minX;
            }
            if (codeOut === codeA) {
              xA = xI; yA = yI; codeA = outCode(xA, yA);
            } else {
              xB = xI; yB = yI; codeB = outCode(xB, yB);
            }
          }
        };
        const minX = rectSel.x, minY = rectSel.y, maxX = rectSel.x + rectSel.width, maxY = rectSel.y + rectSel.height;
        const hitTolerance = Math.max(6 / viewScale, 4);
        const pointToSegDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
          const dx = x2 - x1, dy = y2 - y1;
          if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
          const cx = x1 + t * dx, cy = y1 + t * dy;
          return Math.hypot(px - cx, py - cy);
        };
        const next = new Set<string>(isShiftPressed ? Array.from(selectedIds) : []);
        for (const s of drawingStrokes) {
          let hit = false;
          if (tiny) {
            // Click selection: nearest
            if (s.type === 'via') {
              const c = s.points[0];
              const r = Math.max(1, s.size / 2);
              const d = Math.hypot(c.x - start.x, c.y - start.y);
              hit = d <= Math.max(r, hitTolerance);
            } else {
              for (let i = 0; i < s.points.length - 1; i++) {
                const p1 = s.points[i], p2 = s.points[i + 1];
                const d = pointToSegDist(start.x, start.y, p1.x, p1.y, p2.x, p2.y);
                if (d <= Math.max(hitTolerance, s.size / 2)) { hit = true; break; }
              }
            }
          } else {
            // Rectangle selection
            if (s.type === 'via') {
              const c = s.points[0];
              hit = withinRect(c.x, c.y);
            } else {
              for (let i = 0; i < s.points.length - 1; i++) {
                const p1 = s.points[i], p2 = s.points[i + 1];
                if (segIntersectsRect(p1.x, p1.y, p2.x, p2.y, minX, minY, maxX, maxY) ||
                    (withinRect(p1.x, p1.y) && withinRect(p2.x, p2.y))) { hit = true; break; }
              }
            }
          }
          if (hit) next.add(s.id);
        }
        setSelectedIds(next);
      }
    }
    if (isDrawing && currentStroke.length > 0) {
      if (currentTool === 'draw' && drawingMode !== 'trace') {
        // Freehand drawing (not trace-click mode)
        const newStroke: DrawingStroke = {
          id: Date.now().toString(),
          points: currentStroke,
          color: brushColor,
          size: brushSize,
          layer: selectedDrawingLayer,
          type: 'trace',
        };
        setDrawingStrokes(prev => [...prev, newStroke]);
        if (selectedDrawingLayer === 'top') {
          setTraceOrderTop(prev => [...prev, newStroke.id]);
        } else {
          setTraceOrderBottom(prev => [...prev, newStroke.id]);
        }
      }
      // For erasing, we don't store the stroke - it directly removes other strokes
      setCurrentStroke([]);
    }
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
    setIsDrawing(false);
    setIsTransforming(false);
    setTransformStartPos(null);
    setIsShiftConstrained(false);
  }, [isDrawing, currentStroke, currentTool, brushColor, brushSize, selectedDrawingLayer, selectRect, selectStart, isSelecting, drawingStrokes, viewScale, isShiftPressed, selectedIds]);


  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clip to content area (exclude fixed border), then translate origin to content top-left
    ctx.save();
    ctx.beginPath();
    ctx.rect(CONTENT_BORDER, CONTENT_BORDER, canvas.width - 2 * CONTENT_BORDER, canvas.height - 2 * CONTENT_BORDER);
    ctx.clip();
    ctx.translate(CONTENT_BORDER, CONTENT_BORDER);
    // Apply global view transform once (pan then scale)
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

    // Draw with perspective-like keystone using slice warping via offscreen canvases
    const drawImageWithKeystone = (
      ctxTarget: CanvasRenderingContext2D,
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      keystoneV: number,
      keystoneH: number,
      destW: number,
      destH: number,
    ) => {
      const base = document.createElement('canvas');
      base.width = srcW;
      base.height = srcH;
      const bctx = base.getContext('2d', { willReadFrequently: true })!;
      bctx.clearRect(0, 0, srcW, srcH);
      bctx.drawImage(source as any, 0, 0, srcW, srcH);

      let current = base;

      if (Math.abs(keystoneV) > 1e-6) {
        const tanV = Math.tan(keystoneV);
        const topScale = Math.max(0.2, 1 - tanV);
        const bottomScale = Math.max(0.2, 1 + tanV);
        const maxScale = Math.max(topScale, bottomScale);
        const newW = Math.max(1, Math.ceil(srcW * maxScale));
        const temp = document.createElement('canvas');
        temp.width = newW;
        temp.height = srcH;
        const tctx = temp.getContext('2d', { willReadFrequently: true })!;
        tctx.clearRect(0, 0, newW, srcH);
        for (let y = 0; y < srcH; y++) {
          const t = srcH <= 1 ? 0 : (y / (srcH - 1));
          const scaleRow = topScale * (1 - t) + bottomScale * t;
          const dw = Math.max(1, srcW * scaleRow);
          const dx = (newW - dw) / 2;
          tctx.drawImage(current, 0, y, srcW, 1, dx, y, dw, 1);
        }
        current = temp;
      }

      if (Math.abs(keystoneH) > 1e-6) {
        const tanH = Math.tan(keystoneH);
        const leftScale = Math.max(0.2, 1 - tanH);
        const rightScale = Math.max(0.2, 1 + tanH);
        const maxScale = Math.max(leftScale, rightScale);
        const newH = Math.max(1, Math.ceil(srcH * maxScale));
        const temp2 = document.createElement('canvas');
        temp2.width = current.width;
        temp2.height = newH;
        const tctx2 = temp2.getContext('2d', { willReadFrequently: true })!;
        tctx2.clearRect(0, 0, temp2.width, newH);
        for (let x = 0; x < current.width; x++) {
          const t = current.width <= 1 ? 0 : (x / (current.width - 1));
          const scaleCol = leftScale * (1 - t) + rightScale * t;
          const dh = Math.max(1, srcH * scaleCol);
          const dy = (newH - dh) / 2;
          tctx2.drawImage(current, x, 0, 1, current.height, x, dy, 1, dh);
        }
        current = temp2;
      }

      ctxTarget.drawImage(current, -destW / 2, -destH / 2, destW, destH);
    };

    // Draw images with transformations and apply view transform per draw
    const overlayMode = showTopImage && showBottomImage;
    if (topImage && topImage.bitmap && showTopImage) {
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
      const contentWidth = canvas.width - 2 * CONTENT_BORDER;
      const contentHeight = canvas.height - 2 * CONTENT_BORDER;
      const centerX = contentWidth / 2;
      const centerY = contentHeight / 2;
      ctx.translate(centerX + topImage.x, centerY + topImage.y);
      ctx.rotate((topImage.rotation * Math.PI) / 180);
      // Apply skew (keystone) if any
      if (topImage.skewX || topImage.skewY) {
        const sx = Math.tan(topImage.skewX || 0);
        const sy = Math.tan(topImage.skewY || 0);
        ctx.transform(1, sy, sx, 1, 0, 0);
      }
      ctx.scale(topImage.scale * (topImage.flipX ? -1 : 1), topImage.scale * (topImage.flipY ? -1 : 1));
      const scaledWidth = bmp.width * 1; // already accounted by ctx.scale above
      const scaledHeight = bmp.height * 1;
      const sourceToDraw: CanvasImageSource = isBlackAndWhiteEdges ? createEdgeCanvas(bmp, isBlackAndWhiteInverted) : bmp;
      if ((topImage.keystoneV && Math.abs(topImage.keystoneV) > 1e-6) || (topImage.keystoneH && Math.abs(topImage.keystoneH) > 1e-6)) {
        drawImageWithKeystone(ctx, sourceToDraw, bmp.width, bmp.height, topImage.keystoneV || 0, topImage.keystoneH || 0, scaledWidth, scaledHeight);
      } else {
        ctx.drawImage(sourceToDraw, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    if (bottomImage && bottomImage.bitmap && showBottomImage) {
      const bmp = bottomImage.bitmap;
      ctx.save();
      ctx.globalAlpha = overlayMode ? (transparency / 100) : 1;
      if (isGrayscale && !isBlackAndWhiteEdges) {
        ctx.filter = 'grayscale(100%)';
      } else {
        ctx.filter = 'none';
      }
      // Apply per-image transformations
      const contentWidth = canvas.width - 2 * CONTENT_BORDER;
      const contentHeight = canvas.height - 2 * CONTENT_BORDER;
      const centerX = contentWidth / 2;
      const centerY = contentHeight / 2;
      ctx.translate(centerX + bottomImage.x, centerY + bottomImage.y);
      ctx.rotate((bottomImage.rotation * Math.PI) / 180);
      // Apply skew (keystone) if any
      if (bottomImage.skewX || bottomImage.skewY) {
        const sx = Math.tan(bottomImage.skewX || 0);
        const sy = Math.tan(bottomImage.skewY || 0);
        ctx.transform(1, sy, sx, 1, 0, 0);
      }
      ctx.scale(bottomImage.scale * (bottomImage.flipX ? -1 : 1), bottomImage.scale * (bottomImage.flipY ? -1 : 1));
      const scaledWidth = bmp.width * 1;
      const scaledHeight = bmp.height * 1;
      const sourceToDrawB: CanvasImageSource = isBlackAndWhiteEdges ? createEdgeCanvas(bmp, isBlackAndWhiteInverted) : bmp;
      if ((bottomImage.keystoneV && Math.abs(bottomImage.keystoneV) > 1e-6) || (bottomImage.keystoneH && Math.abs(bottomImage.keystoneH) > 1e-6)) {
        drawImageWithKeystone(ctx, sourceToDrawB, bmp.width, bmp.height, bottomImage.keystoneV || 0, bottomImage.keystoneH || 0, scaledWidth, scaledHeight);
      } else {
        ctx.drawImage(sourceToDrawB, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    // Always draw strokes on top (respecting view transform applied above)
    drawStrokes(ctx);
    // Draw active selection rectangle in view space for perfect alignment
    if (currentTool === 'select' && selectRect) {
      ctx.save();
      // Use bright cyan with semi-transparent fill
      const dash = Math.max(2, 6 / Math.max(0.0001, viewScale));
      ctx.strokeStyle = '#00bfff';
      ctx.fillStyle = 'rgba(0, 191, 255, 0.15)';
      ctx.lineWidth = Math.max(1, 1.5 / Math.max(0.0001, viewScale));
      ctx.setLineDash([dash, dash]);
      ctx.beginPath();
      ctx.rect(selectRect.x, selectRect.y, selectRect.width, selectRect.height);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // Restore after view scaling
    ctx.restore();
  }, [topImage, bottomImage, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale, isBlackAndWhiteEdges, isBlackAndWhiteInverted, selectedImageForTransform, selectedDrawingLayer, viewScale, viewPan.x, viewPan.y, showTopImage, showBottomImage, selectRect]);

  // Resize scrollbar extents based on transformed image bounds
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const hContent = hScrollContentRef.current;
    const vContent = vScrollContentRef.current;
    if (!canvas || !container || !hContent || !vContent) return;

    let bounds: Bounds | null = null;
    const contentWidth = canvas.width - 2 * CONTENT_BORDER;
    const contentHeight = canvas.height - 2 * CONTENT_BORDER;
    const centerX = contentWidth / 2;
    const centerY = contentHeight / 2;
    const addImageBounds = (img: typeof topImage | typeof bottomImage) => {
      if (!img || !img.bitmap) return;
      const rawW = img.bitmap.width;
      const rawH = img.bitmap.height;
      // Keystone: approximate by scaling width/height by max edge scale
      const tanV = img.keystoneV ? Math.tan(img.keystoneV) : 0;
      const tanH = img.keystoneH ? Math.tan(img.keystoneH) : 0;
      const topScale = Math.max(0.2, 1 - tanV);
      const bottomScale = Math.max(0.2, 1 + tanV);
      const leftScale = Math.max(0.2, 1 - tanH);
      const rightScale = Math.max(0.2, 1 + tanH);
      const kScaleW = Math.max(topScale, bottomScale);
      const kScaleH = Math.max(leftScale, rightScale);
      const wK = rawW * kScaleW;
      const hK = rawH * kScaleH;

      // Slant (skew) extents: shear before rotation
      const sx = img.skewX ? Math.tan(img.skewX) : 0; // horizontal shear
      const sy = img.skewY ? Math.tan(img.skewY) : 0; // vertical shear
      const absScale = Math.abs(img.scale);
      const wSheared = Math.abs(absScale) * wK + Math.abs(sx) * Math.abs(absScale) * hK;
      const hSheared = Math.abs(sy) * Math.abs(absScale) * wK + Math.abs(absScale) * hK;

      // Use unit scale in bounds since dimensions already include scale magnitude
      const b = rectTransformedBounds(
        wSheared,
        hSheared,
        centerX,
        centerY,
        img.x,
        img.y,
        1,
        1,
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

    const EDGE_PAD = 8; // small pad to ensure the very edges are reachable
    const desiredW = Math.max(container.clientWidth, Math.ceil(widthScreen) + EDGE_PAD * 2);
    const desiredH = Math.max(container.clientHeight, Math.ceil(heightScreen) + EDGE_PAD * 2);
    hContent.style.width = `${desiredW}px`;
    vContent.style.height = `${desiredH}px`;
    // Update content origin (position of left/top edge in screen space when viewPan=0)
    contentOriginXRef.current = nb.minX * viewScale - EDGE_PAD;
    contentOriginYRef.current = nb.minY * viewScale - EDGE_PAD;
    // After content size changes, sync scrollbars to current pan
    const h = hScrollRef.current;
    const v = vScrollRef.current;
    isSyncingScrollRef.current = true;
    if (h) {
      const maxX = Math.max(0, h.scrollWidth - h.clientWidth);
      const desired = Math.max(0, Math.min(maxX, -(viewPan.x + contentOriginXRef.current)));
      h.scrollLeft = desired;
    }
    if (v) {
      const maxY = Math.max(0, v.scrollHeight - v.clientHeight);
      const desired = Math.max(0, Math.min(maxY, -(viewPan.y + contentOriginYRef.current)));
      v.scrollTop = desired;
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, [topImage, bottomImage, viewScale, viewPan.x, viewPan.y, canvasSize.width, canvasSize.height]);

  // Responsive canvas sizing: fill available space while keeping 1.6:1 aspect ratio
  React.useEffect(() => {
    const computeSize = () => {
      const container = canvasContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ASPECT = 1.6;
      // Available dimensions inside container, accounting for top toolbar (~42px) and some padding
      const toolbarH = 42 + 16;
      const availableW = Math.max(300, container.clientWidth - 16);
      const availableH = Math.max(240, window.innerHeight - rect.top - 24 - toolbarH);
      const widthByHeight = Math.floor(availableH * ASPECT);
      const width = Math.min(availableW, widthByHeight);
      const height = Math.floor(width / ASPECT);
      setCanvasSize(prev => (prev.width === width && prev.height === height) ? prev : { width, height });
    };
    computeSize();
    window.addEventListener('resize', computeSize);
    return () => window.removeEventListener('resize', computeSize);
  }, []);

  const drawStrokes = (ctx: CanvasRenderingContext2D) => {
    drawingStrokes.forEach(stroke => {
      // Show strokes based on layer toggles
      let shouldShowStroke = false;
      if (stroke.type === 'via') {
        shouldShowStroke = showViasLayer;
      } else {
        if (stroke.layer === 'top') shouldShowStroke = showTopTracesLayer;
        else if (stroke.layer === 'bottom') shouldShowStroke = showBottomTracesLayer;
      }
        
      if (shouldShowStroke) {
        if (stroke.type === 'via') {
          // Selection highlight
          if (selectedIds.has(stroke.id)) {
            const c = stroke.points[0];
            const rOuter = Math.max(0.5, stroke.size / 2) + 3;
            ctx.strokeStyle = '#00bfff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(c.x, c.y, rOuter, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // Outer ring + inner filled pad (inner = 1/2 outer diameter)
          const c = stroke.points[0];
          const rOuter = Math.max(0.5, stroke.size / 2);
          const rInner = rOuter * 0.5;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = Math.max(1, Math.min(2, rOuter * 0.25));
          ctx.beginPath();
          ctx.arc(c.x, c.y, rOuter, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = stroke.color;
          ctx.beginPath();
          ctx.arc(c.x, c.y, rInner, 0, Math.PI * 2);
          ctx.fill();
        } else {
          if (stroke.points.length === 1) {
            const p = stroke.points[0];
            const r = Math.max(0.5, stroke.size / 2);
            if (selectedIds.has(stroke.id)) {
              ctx.strokeStyle = '#00bfff';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 3]);
              ctx.beginPath();
              ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.fillStyle = stroke.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            if (selectedIds.has(stroke.id)) {
              ctx.strokeStyle = '#00bfff';
              ctx.lineWidth = stroke.size + 4;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalAlpha = 0.6;
              ctx.beginPath();
              stroke.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
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
        }
      }
    });

    // Draw current stroke if it's on the appropriate layer and visible
    if (currentStroke.length > 0) {
      const currentLayer = selectedDrawingLayer; // Use the selected drawing layer
      let shouldShowCurrentStroke = true;
      if (currentTool === 'draw') {
        if (drawingMode === 'via') {
          shouldShowCurrentStroke = showViasLayer;
        } else {
          shouldShowCurrentStroke = currentLayer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
        }
      }
        
      if (shouldShowCurrentStroke) {
        if (currentTool === 'draw') {
          if (drawingMode === 'via') {
            const center = currentStroke[currentStroke.length - 1];
            const rOuter = Math.max(0.5, brushSize / 2);
            const rInner = rOuter * 0.5;
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = Math.max(1, Math.min(2, rOuter * 0.25));
            ctx.beginPath();
            ctx.arc(center.x, center.y, rOuter, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = brushColor;
            ctx.beginPath();
            ctx.arc(center.x, center.y, rInner, 0, Math.PI * 2);
            ctx.fill();
          } else {
            if (currentStroke.length === 1) {
              const p = currentStroke[0];
              const r = Math.max(0.5, brushSize / 2);
              ctx.fillStyle = brushColor;
              ctx.beginPath();
              ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
              ctx.fill();
            } else {
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
            }
          }
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
    // Reset only the selected image to its original transform
    if (!selectedImageForTransform) return;
    updateImageTransform(selectedImageForTransform, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      skewX: 0,
      skewY: 0,
      keystoneV: 0,
      keystoneH: 0,
    });
    // Also restore color mode (global)
    setIsGrayscale(false);
    setIsBlackAndWhiteEdges(false);
    setIsBlackAndWhiteInverted(false);
  }, [updateImageTransform, selectedImageForTransform]);

  // Enhanced keyboard functionality for sliders, drawing undo, and image transformation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Drawing undo: Cmd/Ctrl+Z removes last stroke on the selected layer
    if (currentTool === 'draw' || currentTool === 'erase') {
      const isUndo = (e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
      if (isUndo) {
        e.preventDefault();
        e.stopPropagation();
        // If a stroke is in progress, cancel it
        if (isDrawing && currentStroke.length > 0) {
          setCurrentStroke([]);
          return;
        }
        // Remove the last stroke of the current type on the selected layer
        if (currentTool === 'draw' && (drawingMode === 'via' || drawingMode === 'trace')) {
          setDrawingStrokes(prev => {
            for (let i = prev.length - 1; i >= 0; i--) {
              const s = prev[i];
              if (s.layer === selectedDrawingLayer && s.type === drawingMode) {
                return [...prev.slice(0, i), ...prev.slice(i + 1)];
              }
            }
            return prev;
          });
        } else if (currentTool === 'erase') {
        }
        return;
      }
    }

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
      } else if (transformMode === 'slant') {
        // Keystone (skew): Up/Down adjust vertical skew, Left/Right adjust horizontal; all at ±0.5°
        let skewXDeltaDeg = 0; // horizontal shear
        let skewYDeltaDeg = 0; // vertical shear

        switch (e.key) {
          case 'ArrowUp':
            skewYDeltaDeg = -0.5;
            break;
          case 'ArrowDown':
            skewYDeltaDeg = 0.5;
            break;
          case 'ArrowLeft':
            skewXDeltaDeg = -0.5;
            break;
          case 'ArrowRight':
            skewXDeltaDeg = 0.5;
            break;
          default:
            break;
        }

        if (skewXDeltaDeg !== 0 || skewYDeltaDeg !== 0) {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const clamp = (v: number) => Math.max(-0.7, Math.min(0.7, v)); // clamp to ~±40° to avoid extremes
          if (selectedImageForTransform === 'top' && topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
              skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
            } : null);
          } else if (selectedImageForTransform === 'bottom' && bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
              skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
            } : null);
          }
        }
      } else if (transformMode === 'keystone') {
        // Perspective-like keystone: Up/Down = vertical keystone, Left/Right = horizontal keystone; ±0.5°
        let kHDeltaDeg = 0; // horizontal keystone
        let kVDeltaDeg = 0; // vertical keystone

        switch (e.key) {
          case 'ArrowUp':
            kVDeltaDeg = -0.5;
            break;
          case 'ArrowDown':
            kVDeltaDeg = 0.5;
            break;
          case 'ArrowLeft':
            kHDeltaDeg = -0.5;
            break;
          case 'ArrowRight':
            kHDeltaDeg = 0.5;
            break;
          default:
            break;
        }

        if (kHDeltaDeg !== 0 || kVDeltaDeg !== 0) {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const clamp = (v: number) => Math.max(-0.35, Math.min(0.35, v)); // clamp to ~±20° to avoid extremes
          if (selectedImageForTransform === 'top' && topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
              keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
            } : null);
          } else if (selectedImageForTransform === 'bottom' && bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
              keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
            } : null);
          }
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

  // Transparency auto-cycle (0% → 100% → 0%) with 1s period while checked
  React.useEffect(() => {
    if (isTransparencyCycling) {
      transparencyCycleStartRef.current = performance.now();
      setTransparency(0);
      const tick = (now: number) => {
        const start = transparencyCycleStartRef.current || now;
        const periodMs = 1000;
        const phase = ((now - start) % periodMs) / periodMs; // 0..1
        const tri = 1 - Math.abs(1 - 2 * phase); // 0→1→0 over 1s
        setTransparency(Math.round(tri * 100));
        transparencyCycleRafRef.current = requestAnimationFrame(tick);
      };
      transparencyCycleRafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (transparencyCycleRafRef.current) {
        cancelAnimationFrame(transparencyCycleRafRef.current);
        transparencyCycleRafRef.current = null;
      }
    };
  }, [isTransparencyCycling]);

  // Dynamic custom cursor that reflects tool, mode, color and brush size
  React.useEffect(() => {
    const kind: 'trace' | 'via' | 'erase' | 'magnify' | 'default' =
      currentTool === 'erase'
        ? 'erase'
        : currentTool === 'magnify'
        ? 'magnify'
        : currentTool === 'draw'
        ? (drawingMode === 'via' ? 'via' : 'trace')
        : 'default';
    if (kind === 'default') { setCanvasCursor(undefined); return; }
    const scale = Math.max(1, viewScale);
    const diameterPx = kind === 'magnify' ? 18 : Math.max(6, Math.round(brushSize * scale));
    const pad = 4;
    const size = diameterPx + pad * 2 + (kind === 'magnify' ? 8 : 0); // extra room for handle/plus
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCanvasCursor(undefined); return; }
    const cx = size / 2;
    const cy = size / 2;
    const r = diameterPx / 2;
    ctx.clearRect(0,0,size,size);
    if (kind === 'via') {
      // Outer ring
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = Math.max(1, Math.min(2, r * 0.25));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      // Inner filled pad (half diameter)
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'trace') {
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'erase') {
      const side = brushSize;
      const half = side / 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(cx - half, cy - half, side, side);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'magnify') {
      // Magnifying glass with +/- sign, handle to bottom-right
      const lensR = r;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      // Lens
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, lensR, 0, Math.PI * 2);
      ctx.stroke();
      // Handle
      const hx1 = cx + lensR * 0.6;
      const hy1 = cy + lensR * 0.6;
      const hx2 = hx1 + 6;
      const hy2 = hy1 + 6;
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();
      // +/- sign
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 2);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.stroke();
      if (!isShiftPressed) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 6);
        ctx.lineTo(cx - 2, cy + 2);
        ctx.stroke();
      }
    }
    const url = `url(${canvas.toDataURL()}) ${Math.round(cx)} ${Math.round(cy)}, crosshair`;
    setCanvasCursor(url);
  }, [currentTool, drawingMode, brushColor, brushSize, viewScale, isShiftPressed]);

  // Redraw canvas when dependencies change
  React.useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Redraw when canvas size changes
  React.useEffect(() => {
    drawCanvas();
  }, [canvasSize.width, canvasSize.height]);

  // (Printing uses the browser's native dialog)

  // Track Shift key for Magnify icon +/- hint
  React.useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(true); };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Close menus when clicking outside
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuBarRef.current) return;
      if (!menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Draw small thumbnails for layer preview/selection
  React.useEffect(() => {
    const drawThumb = (ref: React.RefObject<HTMLCanvasElement | null>, img: PCBImage | null) => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      if (img?.bitmap) {
        const bmp = img.bitmap;
        const scale = Math.min(W / bmp.width, H / bmp.height);
        const dw = Math.max(1, Math.floor(bmp.width * scale));
        const dh = Math.max(1, Math.floor(bmp.height * scale));
        const dx = Math.floor((W - dw) / 2);
        const dy = Math.floor((H - dh) / 2);
        ctx.drawImage(bmp, dx, dy, dw, dh);
      }
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    };
    drawThumb(topThumbRef, topImage);
    drawThumb(bottomThumbRef, bottomImage);
  }, [topImage, bottomImage]);

  // Maintain independent stacks for vias and trace segments in insertion order
  React.useEffect(() => {
    const vTop: Via[] = [];
    const vBot: Via[] = [];
    const tTop: TraceSegment[] = [];
    const tBot: TraceSegment[] = [];
    for (const s of drawingStrokes) {
      if (s.type === 'via' && s.points.length >= 1) {
        const c = s.points[0];
        const v: Via = { x: c.x, y: c.y, size: s.size, color: s.color };
        if (s.layer === 'top') vTop.push(v); else vBot.push(v);
      } else if (s.type === 'trace' && s.points.length >= 2) {
        for (let i = 0; i < s.points.length - 1; i++) {
          const p1 = s.points[i];
          const p2 = s.points[i + 1];
          const seg: TraceSegment = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, size: s.size, color: s.color };
          if (s.layer === 'top') tTop.push(seg); else tBot.push(seg);
        }
      }
    }
    setViasTop(vTop);
    setViasBottom(vBot);
    setTracesTop(tTop);
    setTracesBottom(tBot);
  }, [drawingStrokes]);

  // Save project state as JSON (including embedded images)
  const saveProject = useCallback(async () => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}_${pad2(now.getMonth() + 1)}_${pad2(now.getDate())}_${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const filename = `pcb_project_${ts}.json`;
    const project = {
      version: 1,
      savedAt: ts,
      view: {
        currentView,
        viewScale,
        viewPan,
        showBothLayers,
        selectedDrawingLayer,
      },
      images: {
        top: topImage ? {
          name: topImage.name,
          width: topImage.width,
          height: topImage.height,
          dataUrl: topImage.dataUrl ?? topImage.url, // prefer embedded content
          x: topImage.x, y: topImage.y,
          scale: topImage.scale,
          rotation: topImage.rotation,
          flipX: topImage.flipX, flipY: topImage.flipY,
          skewX: topImage.skewX, skewY: topImage.skewY,
          keystoneV: topImage.keystoneV, keystoneH: topImage.keystoneH,
        } : null,
        bottom: bottomImage ? {
          name: bottomImage.name,
          width: bottomImage.width,
          height: bottomImage.height,
          dataUrl: bottomImage.dataUrl ?? bottomImage.url,
          x: bottomImage.x, y: bottomImage.y,
          scale: bottomImage.scale,
          rotation: bottomImage.rotation,
          flipX: bottomImage.flipX, flipY: bottomImage.flipY,
          skewX: bottomImage.skewX, skewY: bottomImage.skewY,
          keystoneV: bottomImage.keystoneV, keystoneH: bottomImage.keystoneH,
        } : null,
      },
      drawing: {
        viasTop,
        viasBottom,
        tracesTop,
        tracesBottom,
      },
    };
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // Prefer File System Access API when available (lets user choose folder/create folder)
    const w = window as any;
    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'PCB Project', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        // If user cancels, fall back to download is unnecessary; just return
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed, falling back to download', e);
      }
    }
    // Fallback: regular download (browser save dialog)
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 0);
  }, [currentView, viewScale, viewPan, showBothLayers, selectedDrawingLayer, topImage, bottomImage, viasTop, viasBottom, tracesTop, tracesBottom]);

  // Load project from JSON (images embedded)
  const loadProject = useCallback(async (project: any) => {
    try {
      // Restore view state
      if (project.view) {
        if (project.view.currentView) setCurrentView(project.view.currentView);
        if (project.view.viewScale != null) setViewScale(project.view.viewScale);
        if (project.view.viewPan) setViewPan(project.view.viewPan);
        if (project.view.showBothLayers != null) setShowBothLayers(project.view.showBothLayers);
        if (project.view.selectedDrawingLayer) setSelectedDrawingLayer(project.view.selectedDrawingLayer);
      }
      // Helper to build PCBImage from saved data
      const buildImage = async (img: any): Promise<PCBImage | null> => {
        if (!img) return null;
        let bitmap: ImageBitmap | null = null;
        if (img.dataUrl) {
          const blob = await (await fetch(img.dataUrl)).blob();
          bitmap = await createImageBitmap(blob);
        }
        return {
          url: img.dataUrl ?? '',
          name: img.name ?? 'image',
          width: img.width ?? (bitmap ? bitmap.width : 0),
          height: img.height ?? (bitmap ? bitmap.height : 0),
          dataUrl: img.dataUrl,
          x: img.x ?? 0,
          y: img.y ?? 0,
          scale: img.scale ?? 1,
          rotation: img.rotation ?? 0,
          flipX: !!img.flipX,
          flipY: !!img.flipY,
          skewX: img.skewX ?? 0,
          skewY: img.skewY ?? 0,
          keystoneV: img.keystoneV ?? 0,
          keystoneH: img.keystoneH ?? 0,
          bitmap,
        };
      };
      const newTop = await buildImage(project.images?.top);
      const newBottom = await buildImage(project.images?.bottom);
      setTopImage(newTop);
      setBottomImage(newBottom);

      // Rebuild drawing strokes from saved arrays (order preserved)
      const strokes: DrawingStroke[] = [];
      const pushVia = (v: Via, layer: 'top' | 'bottom') => {
        strokes.push({
          id: `${Date.now()}-via-${Math.random()}`,
          points: [{ x: v.x, y: v.y }],
          color: v.color,
          size: v.size,
          layer,
          type: 'via',
        });
      };
      const pushSeg = (s: TraceSegment, layer: 'top' | 'bottom') => {
        strokes.push({
          id: `${Date.now()}-trace-${Math.random()}`,
          points: [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }],
          color: s.color,
          size: s.size,
          layer,
          type: 'trace',
        });
      };
      (project.drawing?.viasTop ?? []).forEach((v: Via) => pushVia(v, 'top'));
      (project.drawing?.viasBottom ?? []).forEach((v: Via) => pushVia(v, 'bottom'));
      (project.drawing?.tracesTop ?? []).forEach((s: TraceSegment) => pushSeg(s, 'top'));
      (project.drawing?.tracesBottom ?? []).forEach((s: TraceSegment) => pushSeg(s, 'bottom'));
      setDrawingStrokes(strokes);
    } catch (err) {
      console.error('Failed to open project', err);
      alert('Failed to open project file. See console for details.');
    }
  }, []);

  React.useEffect(() => {
    currentStrokeRef.current = currentStroke;
  }, [currentStroke]);

  // Reset in-progress trace when switching mode or layer to avoid mixing
  const prevModeRef = React.useRef<'trace' | 'via'>(drawingMode);
  const prevLayerRef = React.useRef<'top' | 'bottom'>(selectedDrawingLayer);
  React.useEffect(() => {
    // If we were in trace mode and had an in-progress stroke, finalize it on mode/layer change
    if (currentTool === 'draw' && prevModeRef.current === 'trace' && currentStroke.length > 0) {
      const newStroke: DrawingStroke = {
        id: `${Date.now()}-trace-autofinalize`,
        points: currentStroke,
        color: brushColor,
        size: brushSize,
        layer: prevLayerRef.current,
        type: 'trace',
      };
      setDrawingStrokes(prev => [...prev, newStroke]);
      if (prevLayerRef.current === 'top') {
        setTraceOrderTop(prev => [...prev, newStroke.id]);
      } else {
        setTraceOrderBottom(prev => [...prev, newStroke.id]);
      }
    }
    setCurrentStroke([]);
    setIsDrawing(false);
    prevModeRef.current = drawingMode;
    prevLayerRef.current = selectedDrawingLayer;
  }, [drawingMode, selectedDrawingLayer, currentTool, currentStroke, brushColor, brushSize]);

  // Simple HSV -> HEX for palette generation
  const hsvToHex = useCallback((h: number, s: number, v: number): string => {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const R = Math.round((r + m) * 255);
    const G = Math.round((g + m) * 255);
    const B = Math.round((b + m) * 255);
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
  }, []);

  const palette8x8 = React.useMemo(() => {
    const colors: string[] = [];
    const steps = 64; // 8x8
    for (let i = 0; i < steps; i++) {
      const hue = (i * 360) / steps; // evenly spaced hues 0..360
      colors.push(hsvToHex(hue, 0.9, 0.9)); // constant saturation/value
    }
    return colors;
  }, [hsvToHex]);

  // Force redraw when drawingStrokes change (for eraser)
  React.useEffect(() => {
    drawCanvas();
  }, [drawingStrokes]);

  // Keep scrollbars in sync with viewPan changes from other interactions
  React.useEffect(() => {
    const h = hScrollRef.current;
    const v = vScrollRef.current;
    isSyncingScrollRef.current = true;
    if (h) {
      const maxX = Math.max(0, h.scrollWidth - h.clientWidth);
      const origin = contentOriginXRef.current;
      const desired = Math.max(0, Math.min(maxX, -(viewPan.x + origin)));
      if (Math.abs(h.scrollLeft - desired) > 0.5) h.scrollLeft = desired;
    }
    if (v) {
      const maxY = Math.max(0, v.scrollHeight - v.clientHeight);
      const origin = contentOriginYRef.current;
      const desired = Math.max(0, Math.min(maxY, -(viewPan.y + origin)));
      if (Math.abs(v.scrollTop - desired) > 0.5) v.scrollTop = desired;
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, [viewPan.x, viewPan.y]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔧 PCB Reverse Engineering Tool</h1>
      </header>

      {/* Application menu bar */}
      <div ref={menuBarRef} style={{ position: 'relative', background: 'rgba(250,250,255,0.9)', borderBottom: '1px solid #e6e6ef', padding: '6px 12px', display: 'flex', gap: 16, alignItems: 'center', zIndex: 3 }}>
        {/* File menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setOpenMenu(m => m === 'file' ? null : 'file'); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: openMenu === 'file' ? '#eef3ff' : '#fff', fontWeight: 600, color: '#222' }}>
            File ▾
          </button>
          {openMenu === 'file' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 200, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
              <button onClick={() => { fileInputTopRef.current?.click(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Load Top PCB…</button>
              <button onClick={() => { fileInputBottomRef.current?.click(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Load Bottom PCB…</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { void saveProject(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Save Project…</button>
              <button onClick={() => { void saveProject(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Save As…</button>
              <button onClick={async () => {
                const w = window as any;
                if (typeof w.showOpenFilePicker === 'function') {
                  try {
                    const [handle] = await w.showOpenFilePicker({
                      multiple: false,
                      types: [{ description: 'PCB Project', accept: { 'application/json': ['.json'] } }],
                    });
                    const file = await handle.getFile();
                    const text = await file.text();
                    const project = JSON.parse(text);
                    await loadProject(project);
                    setOpenMenu(null);
                    return;
                  } catch (e) {
                    if ((e as any)?.name === 'AbortError') { setOpenMenu(null); return; }
                    console.warn('showOpenFilePicker failed, falling back to input', e);
                  }
                }
                openProjectRef.current?.click();
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Open Project…</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { window.print(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Print…</button>
              <button onClick={() => { window.print(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Printer Settings…</button>
            </div>
          )}
        </div>

        {/* View menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setOpenMenu(m => m === 'view' ? null : 'view'); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: openMenu === 'view' ? '#eef3ff' : '#fff', fontWeight: 600, color: '#222' }}>
            View ▾
          </button>
          {openMenu === 'view' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 200, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
              <button onClick={() => { setCurrentView('top'); setCurrentTool('draw'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Top</button>
              <button onClick={() => { setCurrentView('bottom'); setCurrentTool('draw'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Bottom</button>
              <button onClick={() => { setCurrentView('overlay'); setCurrentTool('draw'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Overlay</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { setIsTransparencyCycling(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                {isTransparencyCycling ? 'Stop Transparency Cycle' : 'Start Transparency Cycle'}
              </button>
            </div>
          )}
        </div>

        {/* Transform menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setOpenMenu(m => m === 'transform' ? null : 'transform'); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: openMenu === 'transform' ? '#eef3ff' : '#fff', fontWeight: 600, color: '#222' }}>
            Transform ▾
          </button>
          {openMenu === 'transform' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 260, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
              <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>Select Image</div>
              <button disabled={!topImage} onClick={() => { setSelectedImageForTransform('top'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: topImage ? '#f2f2f2' : '#777', background: 'transparent', border: 'none' }}>Top Image</button>
              <button disabled={!bottomImage} onClick={() => { setSelectedImageForTransform('bottom'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: bottomImage ? '#f2f2f2' : '#777', background: 'transparent', border: 'none' }}>Bottom Image</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { if (selectedImageForTransform) updateImageTransform(selectedImageForTransform, { flipX: !(selectedImageForTransform === 'top' ? (topImage?.flipX || false) : (bottomImage?.flipX || false)) }); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Toggle Horizontal Flip</button>
              <button onClick={() => { if (selectedImageForTransform) updateImageTransform(selectedImageForTransform, { flipY: !(selectedImageForTransform === 'top' ? (topImage?.flipY || false) : (bottomImage?.flipY || false)) }); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Toggle Vertical Flip</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { setTransformMode('nudge'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Mode: Nudge</button>
              <button onClick={() => { setTransformMode('scale'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Mode: Scale</button>
              <button onClick={() => { setTransformMode('rotate'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Mode: Rotate</button>
              <button onClick={() => { setTransformMode('slant'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Mode: Slant</button>
              <button onClick={() => { setTransformMode('keystone'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Mode: Keystone</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => {
                setCurrentTool('transform');
                if (isGrayscale || isBlackAndWhiteEdges) {
                  setIsGrayscale(false);
                  setIsBlackAndWhiteEdges(false);
                  setIsBlackAndWhiteInverted(false);
                } else {
                  setIsGrayscale(true);
                }
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                {(isGrayscale || isBlackAndWhiteEdges) ? 'Color Mode' : 'Grayscale Mode'}
              </button>
              <button onClick={() => {
                setCurrentTool('transform');
                if (!isBlackAndWhiteEdges) {
                  setIsBlackAndWhiteEdges(true);
                  setIsBlackAndWhiteInverted(false);
                } else {
                  setIsBlackAndWhiteInverted(prev => !prev);
                }
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                {isBlackAndWhiteEdges ? 'Invert Edges' : 'Black & White Edges'}
              </button>
              <button onClick={() => { setCurrentTool('transform'); resetImageTransform(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Reset Transform</button>
            </div>
          )}
        </div>
      </div>

      <div className="main-container">
        {/* Control Panel (hidden; replaced by top menus and left toolstrip) */}
        <div className="control-panel" style={{ display: 'none' }}>
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
                } else if (transformMode === 'slant') {
                  tips.push('Arrow Up/Down: ±0.5° vertical slant. Arrow Left/Right: ±0.5° horizontal slant.');
                } else if (transformMode === 'keystone') {
                  tips.push('Arrow Up/Down: ±0.5° vertical keystone. Arrow Left/Right: ±0.5° horizontal keystone.');
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
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center' }}>
              <button 
                onClick={() => { void saveProject(); }}
                className="load-button"
                title="Save the entire project (images embedded) as JSON"
              >
                💾 Save Project
              </button>
              <button 
                onClick={async () => {
                  const w = window as any;
                  if (typeof w.showOpenFilePicker === 'function') {
                    try {
                      const [handle] = await w.showOpenFilePicker({
                        multiple: false,
                        types: [{ description: 'PCB Project', accept: { 'application/json': ['.json'] } }],
                      });
                      const file = await handle.getFile();
                      const text = await file.text();
                      const project = JSON.parse(text);
                      await loadProject(project);
                      return;
                    } catch (e) {
                      if ((e as any)?.name === 'AbortError') return;
                      console.warn('showOpenFilePicker failed, falling back to input', e);
                    }
                  }
                  openProjectRef.current?.click();
                }}
                className="load-button"
                style={{ marginLeft: 8 }}
                title="Open a saved project JSON"
              >
                📂 Open Project
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
            <input
              ref={openProjectRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const project = JSON.parse(text);
                  await loadProject(project);
                } finally {
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>

          {/* (Tools moved to left toolbar inside canvas area) */}

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
            </div>
            
            {currentView === 'overlay' && (
              <div className="slider-group">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ marginRight: 8 }}>Transparency: {transparency}%</label>
                  <label className="radio-label">
                    <input
                      type="checkbox"
                      checked={isTransparencyCycling}
                      onChange={(e) => setIsTransparencyCycling(e.target.checked)}
                    />
                    <span style={{ marginLeft: 8 }}>Cycle</span>
                  </label>
                </div>
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


          <div className="control-section" onMouseDown={() => setCurrentTool('transform')}>
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
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="transformMode"
                      value="slant"
                      checked={transformMode === 'slant'}
                      onChange={() => setTransformMode('slant')}
                    />
                    <span>Slant</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="transformMode"
                      value="keystone"
                      checked={transformMode === 'keystone'}
                      onChange={() => setTransformMode('keystone')}
                    />
                    <span>Keystone</span>
                  </label>
                </div>
              </div>
            )}

            {selectedImageForTransform && (
              <>



              <div className="button-group">
                  <button 
                    onClick={() => {
                      setCurrentTool('transform');
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
                      setCurrentTool('transform');
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
                    onClick={() => { setCurrentTool('transform'); resetImageTransform(); }}
                    className="reset-button small"
                  >
                    Reset Transform
                  </button>
      </div>

              </>
            )}
          </div>

        </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-container" ref={canvasContainerRef} style={{ position: 'relative' }}>
          {/* Left toolstrip (icons) */}
          <div style={{ position: 'absolute', top: 6, left: 6, bottom: 6, width: 44, display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 6px', background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 20 }}>
            <button onClick={() => setCurrentTool('select')} title="Select" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: currentTool === 'select' ? '#e6f0ff' : '#fff', color: '#222' }}>
              <MousePointer size={16} />
            </button>
            <button onClick={() => { setDrawingMode('trace'); setCurrentTool('draw'); }} title="Draw Traces" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: currentTool === 'draw' && drawingMode === 'trace' ? '#e6f0ff' : '#fff', color: '#222' }}>
              <PenLine size={16} />
            </button>
            <button onClick={() => { setDrawingMode('via'); setCurrentTool('draw'); }} title="Draw Vias" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: currentTool === 'draw' && drawingMode === 'via' ? '#e6f0ff' : '#fff', color: '#222' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" fill="none" stroke={brushColor} strokeWidth="3" />
                <circle cx="12" cy="12" r="4" fill={brushColor} />
              </svg>
            </button>
            <button onClick={() => setCurrentTool('erase')} title="Erase" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: currentTool === 'erase' ? '#ffecec' : '#fff', color: '#222' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" fill="#fff" stroke="#111" strokeWidth="2" />
              </svg>
            </button>
            <button onClick={() => setCurrentTool(prev => prev === 'pan' ? 'draw' : 'pan')} title="Move" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: currentTool === 'pan' ? '#e6f0ff' : '#fff', color: '#222' }}>
              <Move size={16} />
            </button>
            <button onClick={() => setCurrentTool(prev => prev === 'magnify' ? 'draw' : 'magnify')} title={isShiftPressed ? 'Zoom Out' : 'Zoom In'} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: currentTool === 'magnify' ? '#e6f0ff' : '#fff', color: '#222' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10" cy="10" r="6" fill="none" stroke="#111" strokeWidth="2" />
                <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                {isShiftPressed ? (
                  <line x1="7" y1="10" x2="13" y2="10" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <>
                    <line x1="7" y1="10" x2="13" y2="10" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                    <line x1="10" y1="7" x2="10" y2="13" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
            {/* Color picker moved just below magnify */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowColorPicker(prev => !prev)} title="Color Picker" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #ddd', background: '#fff' }}>
                <Droplet size={16} color={brushColor} />
              </button>
              {showColorPicker && (
                <div style={{ position: 'absolute', left: 42, top: 0, padding: 8, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 8px 18px rgba(0,0,0,0.18)', zIndex: 50 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 6 }}>
                    {palette8x8.map((c) => (
                      <div
                        key={c}
                        onClick={() => { setBrushColor(c); setShowColorPicker(false); }}
                        title={c}
                        style={{ width: 22, height: 22, backgroundColor: c, border: c === brushColor ? '2px solid #333' : '1px solid #ccc', cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Layers miniatures (Pages-like) with visibility toggles and transparency */}
          <div style={{ position: 'absolute', top: 6, left: 56, bottom: 6, width: 168, padding: 8, display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 2 }}>Layers</div>
            <div onClick={() => setSelectedDrawingLayer('top')} title="Top layer" style={{ cursor: 'pointer', padding: 4, borderRadius: 6, border: selectedDrawingLayer === 'top' ? '2px solid #0b5fff' : '1px solid #ddd', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Top Image</div>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={showTopImage} onChange={(e) => setShowTopImage(e.target.checked)} />
                </label>
              </div>
              <canvas ref={topThumbRef} width={140} height={90} />
            </div>
            <div onClick={() => setSelectedDrawingLayer('bottom')} title="Bottom layer" style={{ cursor: 'pointer', padding: 4, borderRadius: 6, border: selectedDrawingLayer === 'bottom' ? '2px solid #0b5fff' : '1px solid #ddd', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Bottom Image</div>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={showBottomImage} onChange={(e) => setShowBottomImage(e.target.checked)} />
                </label>
              </div>
              <canvas ref={bottomThumbRef} width={140} height={90} />
            </div>
            <div style={{ height: 1, background: '#e9e9ef', margin: '4px 0' }} />
            <div style={{ fontSize: 12, color: '#333', fontWeight: 700 }}>Drawing Layers</div>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showViasLayer} onChange={(e) => setShowViasLayer(e.target.checked)} />
              <span>Vias</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopTracesLayer} onChange={(e) => setShowTopTracesLayer(e.target.checked)} />
              <span>Top Traces</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomTracesLayer} onChange={(e) => setShowBottomTracesLayer(e.target.checked)} />
              <span>Bottom Traces</span>
            </label>
            <div style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, color: '#333' }}>Transparency: {transparency}%</label>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={isTransparencyCycling} onChange={(e) => setIsTransparencyCycling(e.target.checked)} />
                  <span style={{ marginLeft: 6, fontSize: 12 }}>Cycle</span>
                </label>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={transparency}
                onChange={(e) => setTransparency(Number(e.target.value))}
                onDoubleClick={() => handleSliderDoubleClick('transparency')}
                className="slider"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            onDoubleClick={handleCanvasDoubleClick}
            className={`pcb-canvas ${currentTool === 'transform' ? 'transform-cursor' : currentTool === 'draw' ? 'draw-cursor' : currentTool === 'erase' ? 'erase-cursor' : 'default-cursor'}`}
            style={canvasCursor ? { cursor: canvasCursor } : (currentTool === 'pan' ? { cursor: isPanning ? 'grabbing' : 'grab' } : undefined)}
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
              if (isSyncingScrollRef.current) return;
              const el = e.currentTarget;
              const origin = contentOriginXRef.current;
              setViewPan((p) => ({ x: -el.scrollLeft - origin, y: p.y }));
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
              if (isSyncingScrollRef.current) return;
              const el = e.currentTarget;
              const origin = contentOriginYRef.current;
              setViewPan((p) => ({ x: p.x, y: -el.scrollTop - origin }));
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