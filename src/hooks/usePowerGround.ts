import { useState, useCallback } from 'react';

export interface PowerBus {
  id: string;
  name: string;
  voltage: string;
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
}

export interface GroundSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  type?: string;
  pointId?: number;
}

/**
 * Custom hook for managing power and ground symbols
 */
export function usePowerGround() {
  const [powerBuses, setPowerBuses] = useState<PowerBus[]>([]);
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

  return {
    // State
    powerBuses,
    setPowerBuses,
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
  };
}

