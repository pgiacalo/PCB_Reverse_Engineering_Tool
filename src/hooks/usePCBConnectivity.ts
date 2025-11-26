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

