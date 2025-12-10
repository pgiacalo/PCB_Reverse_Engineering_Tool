/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
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

export interface PowerBus {
  id: string;
  name: string;
  voltage: string;
  color: string;
}

export interface GroundBus {
  id: string;
  name: string;
  color: string;
}

export interface PowerSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  powerBusId: string;
  layer: 'top' | 'bottom';
  type?: string;
  pointId?: number;
  notes?: string | null; // Max 500 characters, null until user enters a value
}

export interface GroundSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  groundBusId?: string; // Optional: reference to ground bus (similar to powerBusId)
  layer: 'top' | 'bottom';
  type?: string;
  pointId?: number;
  notes?: string | null; // Max 500 characters, null until user enters a value
}

/**
 * Custom hook for managing power and ground symbols
 */
export function usePowerGround() {
  // Initialize with default power bus: +5VDC
  const [powerBuses, setPowerBuses] = useState<PowerBus[]>(() => [
    { id: 'powerbus-default', name: '+5VDC', voltage: '+5', color: '#ff0000' },
  ]);
  // Initialize with default ground bus: GND
  const [groundBuses, setGroundBuses] = useState<GroundBus[]>(() => [
    { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
  ]);
  const [powerSymbols, setPowerSymbols] = useState<PowerSymbol[]>([]);
  const [groundSymbols, setGroundSymbols] = useState<GroundSymbol[]>([]);
  const [powerEditor, setPowerEditor] = useState<{
    visible: boolean;
    id: string;
    layer: 'top' | 'bottom';
    powerBusId: string;
    x: number;
    y: number;
    size: number;
    color: string;
  } | null>(null);
  const [groundEditor, setGroundEditor] = useState<{
    visible: boolean;
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const addPowerBus = useCallback((bus: PowerBus) => {
    setPowerBuses(prev => [...prev, bus]);
  }, []);

  const updatePowerBus = useCallback((id: string, updates: Partial<PowerBus>) => {
    setPowerBuses(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const removePowerBus = useCallback((id: string) => {
    setPowerBuses(prev => prev.filter(b => b.id !== id));
    // Also remove power symbols that reference this bus
    setPowerSymbols(prev => prev.filter(p => p.powerBusId !== id));
  }, []);

  const addPowerSymbol = useCallback((symbol: PowerSymbol) => {
    setPowerSymbols(prev => [...prev, symbol]);
  }, []);

  const removePowerSymbol = useCallback((id: string) => {
    setPowerSymbols(prev => prev.filter(p => p.id !== id));
  }, []);

  const addGroundSymbol = useCallback((symbol: GroundSymbol) => {
    setGroundSymbols(prev => [...prev, symbol]);
  }, []);

  const removeGroundSymbol = useCallback((id: string) => {
    setGroundSymbols(prev => prev.filter(g => g.id !== id));
  }, []);

  const addGroundBus = useCallback((bus: GroundBus) => {
    setGroundBuses(prev => [...prev, bus]);
  }, []);

  const updateGroundBus = useCallback((id: string, updates: Partial<GroundBus>) => {
    setGroundBuses(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const removeGroundBus = useCallback((id: string) => {
    setGroundBuses(prev => prev.filter(b => b.id !== id));
    // Also remove ground symbols that reference this bus
    setGroundSymbols(prev => prev.filter(g => g.groundBusId === id));
  }, []);

  return {
    // State
    powerBuses,
    setPowerBuses,
    groundBuses,
    setGroundBuses,
    powerSymbols,
    setPowerSymbols,
    groundSymbols,
    setGroundSymbols,
    powerEditor,
    setPowerEditor,
    groundEditor,
    setGroundEditor,
    
    // Actions
    addPowerBus,
    updatePowerBus,
    removePowerBus,
    addPowerSymbol,
    removePowerSymbol,
    addGroundSymbol,
    removeGroundSymbol,
    addGroundBus,
    updateGroundBus,
    removeGroundBus,
  };
}

