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

