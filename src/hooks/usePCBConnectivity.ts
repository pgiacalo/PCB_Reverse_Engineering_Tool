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

// ============================================================================
// React Hook for PCB Connectivity Manager
// ============================================================================

import { useRef, useEffect } from 'react';
import { PCBConnectivityManager } from '../utils/connectivityManager';
import type { 
  PCBComponent, 
  DrawingStroke 
} from '../types';
import type { 
  PowerSymbol, 
  GroundSymbol, 
  PowerBus 
} from './usePowerGround';

/**
 * React hook that provides access to the centralized PCB connectivity manager
 * Automatically syncs when source data changes
 */
export function usePCBConnectivity(
  drawingStrokes: DrawingStroke[],
  componentsTop: PCBComponent[],
  componentsBottom: PCBComponent[],
  powerSymbols: PowerSymbol[],
  groundSymbols: GroundSymbol[],
  powerBuses: PowerBus[]
): PCBConnectivityManager {
  const managerRef = useRef<PCBConnectivityManager | null>(null);
  
  // Initialize manager on first render
  if (!managerRef.current) {
    managerRef.current = new PCBConnectivityManager();
  }
  
  const manager = managerRef.current;
  
  // Sync manager when dependencies change
  useEffect(() => {
    const allComponents = [...componentsTop, ...componentsBottom];
    manager.syncFromState(
      drawingStrokes,
      allComponents,
      powerSymbols,
      groundSymbols,
      powerBuses
    );
  }, [
    drawingStrokes,
    componentsTop,
    componentsBottom,
    powerSymbols,
    groundSymbols,
    powerBuses,
    manager
  ]);
  
  return manager;
}

