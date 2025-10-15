export interface PCBImage {
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

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  timestamp: number;
}

export interface DrawingData {
  strokes: DrawingStroke[];
}

export type ViewMode = 'top' | 'bottom' | 'overlay';

export type Tool = 'draw' | 'erase' | 'pan' | 'zoom' | 'transform';

export interface PCBViewerState {
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  currentView: ViewMode;
  transparency: number;
  zoom: number;
  panX: number;
  panY: number;
  currentTool: Tool;
  brushColor: string;
  brushSize: number;
  drawingData: DrawingData;
  isDrawing: boolean;
  selectedImageForTransform: 'top' | 'bottom' | null;
  isTransforming: boolean;
}
