/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

import { useState, useCallback, useRef } from 'react';
import type { DrawingStroke } from './useDrawing';
import type { PCBComponent } from '../types';
import type { PowerSymbol, GroundSymbol } from './usePowerGround';

/**
 * Snapshot of application state that can be restored
 */
export interface UndoSnapshot {
  drawingStrokes: DrawingStroke[];
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  powerSymbols: PowerSymbol[];
  groundSymbols: GroundSymbol[];
}

/**
 * Custom hook for managing undo functionality
 * Provides single-level undo (only the last change can be undone)
 */
export function useUndo() {
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const isSavingSnapshotRef = useRef(false);

  /**
   * Save a snapshot of the current state before making a change
   */
  const saveSnapshot = useCallback((
    drawingStrokes: DrawingStroke[],
    componentsTop: PCBComponent[],
    componentsBottom: PCBComponent[],
    powerSymbols: PowerSymbol[],
    groundSymbols: GroundSymbol[]
  ) => {
    // Prevent saving snapshot while undoing (which would overwrite the snapshot)
    if (isSavingSnapshotRef.current) {
      return;
    }

    // Create a deep copy of the state
    const snapshot: UndoSnapshot = {
      drawingStrokes: JSON.parse(JSON.stringify(drawingStrokes)),
      componentsTop: JSON.parse(JSON.stringify(componentsTop)),
      componentsBottom: JSON.parse(JSON.stringify(componentsBottom)),
      powerSymbols: JSON.parse(JSON.stringify(powerSymbols)),
      groundSymbols: JSON.parse(JSON.stringify(groundSymbols)),
    };

    setUndoSnapshot(snapshot);
  }, []);

  /**
   * Restore the previous state snapshot
   * Returns the snapshot if available, null otherwise
   */
  const undo = useCallback((): UndoSnapshot | null => {
    if (!undoSnapshot) {
      return null;
    }

    // Mark that we're undoing to prevent saving a snapshot during undo
    isSavingSnapshotRef.current = true;
    
    // Return the snapshot (caller is responsible for applying it)
    const snapshot = undoSnapshot;
    
    // Clear the snapshot after undo (single-level undo)
    setUndoSnapshot(null);
    
    // Reset the flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isSavingSnapshotRef.current = false;
    }, 100);

    return snapshot;
  }, [undoSnapshot]);

  /**
   * Check if undo is available
   */
  const canUndo = undoSnapshot !== null;

  /**
   * Clear the undo snapshot (e.g., when opening a new project)
   */
  const clearSnapshot = useCallback(() => {
    setUndoSnapshot(null);
  }, []);

  return {
    saveSnapshot,
    undo,
    canUndo,
    clearSnapshot,
  };
}
