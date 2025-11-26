import { useState, useRef, useCallback } from 'react';

export interface DrawingPoint {
  id?: number; // globally unique point ID (used for netlist connections)
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via' | 'pad';
  viaType?: string;
  padType?: string;
  notes?: string | null; // Max 500 characters, null until user enters a value
}

/**
 * Custom hook for managing drawing state and operations
 */
export function useDrawing() {
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const [tracePreviewMousePos, setTracePreviewMousePos] = useState<{ x: number; y: number } | null>(null);
  const [drawingMode, setDrawingMode] = useState<'trace' | 'via' | 'pad'>('trace');
  const [selectedDrawingLayer, setSelectedDrawingLayer] = useState<'top' | 'bottom'>('top');
  
  const currentStrokeRef = useRef<DrawingPoint[]>([]);
  const lastTraceClickTimeRef = useRef<number>(0);
  const isDoubleClickingTraceRef = useRef<boolean>(false);

  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, []);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, []);

  const addPointToStroke = useCallback((point: DrawingPoint) => {
    setCurrentStroke(prev => [...prev, point]);
    currentStrokeRef.current = [...currentStrokeRef.current, point];
  }, []);

  const finishStroke = useCallback((stroke: DrawingStroke) => {
    setDrawingStrokes(prev => [...prev, stroke]);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, []);

  return {
    // State
    drawingStrokes,
    setDrawingStrokes,
    isDrawing,
    setIsDrawing,
    currentStroke,
    setCurrentStroke,
    tracePreviewMousePos,
    setTracePreviewMousePos,
    drawingMode,
    setDrawingMode,
    selectedDrawingLayer,
    setSelectedDrawingLayer,
    
    // Refs
    currentStrokeRef,
    lastTraceClickTimeRef,
    isDoubleClickingTraceRef,
    
    // Actions
    startDrawing,
    stopDrawing,
    addPointToStroke,
    finishStroke,
  };
}

