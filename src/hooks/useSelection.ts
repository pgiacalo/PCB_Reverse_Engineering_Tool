import { useState, useCallback } from 'react';

/**
 * Custom hook for managing selection state
 */
export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [selectedPowerIds, setSelectedPowerIds] = useState<Set<string>>(new Set());
  const [selectedGroundIds, setSelectedGroundIds] = useState<Set<string>>(new Set());

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, []);

  const addToSelection = useCallback((id: string, type: 'stroke' | 'component' | 'power' | 'ground' = 'stroke') => {
    if (type === 'stroke') {
      setSelectedIds(prev => new Set([...prev, id]));
    } else if (type === 'component') {
      setSelectedComponentIds(prev => new Set([...prev, id]));
    } else if (type === 'power') {
      setSelectedPowerIds(prev => new Set([...prev, id]));
    } else if (type === 'ground') {
      setSelectedGroundIds(prev => new Set([...prev, id]));
    }
  }, []);

  const removeFromSelection = useCallback((id: string, type: 'stroke' | 'component' | 'power' | 'ground' = 'stroke') => {
    if (type === 'stroke') {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else if (type === 'component') {
      setSelectedComponentIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else if (type === 'power') {
      setSelectedPowerIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else if (type === 'ground') {
      setSelectedGroundIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const setSelection = useCallback((ids: Set<string>, type: 'stroke' | 'component' | 'power' | 'ground' = 'stroke') => {
    if (type === 'stroke') {
      setSelectedIds(ids);
    } else if (type === 'component') {
      setSelectedComponentIds(ids);
    } else if (type === 'power') {
      setSelectedPowerIds(ids);
    } else if (type === 'ground') {
      setSelectedGroundIds(ids);
    }
  }, []);

  return {
    // State
    selectedIds,
    setSelectedIds,
    isSelecting,
    setIsSelecting,
    selectedComponentIds,
    setSelectedComponentIds,
    selectedPowerIds,
    setSelectedPowerIds,
    selectedGroundIds,
    setSelectedGroundIds,
    
    // Actions
    clearSelection,
    addToSelection,
    removeFromSelection,
    setSelection,
  };
}

