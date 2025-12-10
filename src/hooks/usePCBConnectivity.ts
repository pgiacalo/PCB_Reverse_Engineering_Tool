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

