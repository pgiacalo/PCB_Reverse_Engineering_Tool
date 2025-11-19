import { useState, useCallback } from 'react';
import type { PCBComponent } from '../types';

/**
 * Custom hook for managing component state
 */
export function useComponents() {
  const [componentsTop, setComponentsTop] = useState<PCBComponent[]>([]);
  const [componentsBottom, setComponentsBottom] = useState<PCBComponent[]>([]);
  const [componentEditor, setComponentEditor] = useState<{
    visible: boolean;
    layer: 'top' | 'bottom';
    id: string;
    designator: string;
    abbreviation: string;
    manufacturer: string;
    partNumber: string;
    pinCount: number;
    x: number;
    y: number;
  } | null>(null);
  const [connectingPin, setConnectingPin] = useState<{ componentId: string; pinIndex: number } | null>(null);
  const [componentDialogPosition, setComponentDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDialog, setIsDraggingDialog] = useState(false);
  const [dialogDragOffset, setDialogDragOffset] = useState<{ x: number; y: number } | null>(null);

  const addComponent = useCallback((component: PCBComponent, layer: 'top' | 'bottom') => {
    if (layer === 'top') {
      setComponentsTop(prev => [...prev, component]);
    } else {
      setComponentsBottom(prev => [...prev, component]);
    }
  }, []);

  const updateComponent = useCallback((id: string, updates: Partial<PCBComponent>, layer: 'top' | 'bottom') => {
    if (layer === 'top') {
      setComponentsTop(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setComponentsBottom(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  }, []);

  const removeComponent = useCallback((id: string, layer: 'top' | 'bottom') => {
    if (layer === 'top') {
      setComponentsTop(prev => prev.filter(c => c.id !== id));
    } else {
      setComponentsBottom(prev => prev.filter(c => c.id !== id));
    }
  }, []);

  const openComponentEditor = useCallback((component: PCBComponent, layer: 'top' | 'bottom') => {
    setComponentEditor({
      visible: true,
      layer,
      id: component.id,
      designator: component.designator || '',
      abbreviation: (component as any).abbreviation || '',
      manufacturer: 'manufacturer' in component ? (component as any).manufacturer || '' : '',
      partNumber: 'partNumber' in component ? (component as any).partNumber || '' : '',
      pinCount: component.pinCount,
      x: component.x,
      y: component.y,
    });
  }, []);

  const closeComponentEditor = useCallback(() => {
    setComponentEditor(null);
    setConnectingPin(null);
  }, []);

  return {
    // State
    componentsTop,
    setComponentsTop,
    componentsBottom,
    setComponentsBottom,
    componentEditor,
    setComponentEditor,
    connectingPin,
    setConnectingPin,
    componentDialogPosition,
    setComponentDialogPosition,
    isDraggingDialog,
    setIsDraggingDialog,
    dialogDragOffset,
    setDialogDragOffset,
    
    // Actions
    addComponent,
    updateComponent,
    removeComponent,
    openComponentEditor,
    closeComponentEditor,
  };
}

