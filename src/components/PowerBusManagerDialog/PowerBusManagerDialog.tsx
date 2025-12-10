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

import React, { useState, useRef, useEffect } from 'react';

export interface PowerBus {
  id: string;
  name: string;
  voltage: string;
  color: string;
}

export interface PowerSymbol {
  id: string;
  powerBusId: string;
  // ... other fields
}

export interface PowerBusManagerDialogProps {
  visible: boolean;
  onClose: () => void;
  powerBuses: PowerBus[];
  setPowerBuses: React.Dispatch<React.SetStateAction<PowerBus[]>>;
  editingPowerBusId: string | null;
  setEditingPowerBusId: React.Dispatch<React.SetStateAction<string | null>>;
  powers: Array<{ id: string; powerBusId?: string }>;
}

export const PowerBusManagerDialog: React.FC<PowerBusManagerDialogProps> = ({
  visible,
  onClose,
  powerBuses,
  setPowerBuses,
  editingPowerBusId,
  setEditingPowerBusId,
  powers,
}) => {
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Initialize position on first open
  useEffect(() => {
    if (visible && !dialogPosition) {
      setDialogPosition({
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 2 - 200,
      });
    }
  }, [visible, dialogPosition]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dialogPosition && dragOffset) {
        setDialogPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragOffset(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dialogPosition, dragOffset]);

  // Separate buses into existing (sorted) and editing (at bottom)
  const existingBuses = powerBuses.filter(b => b.id !== editingPowerBusId);
  const editingBus = powerBuses.find(b => b.id === editingPowerBusId);
  
  if (!visible) return null;

  // Sort existing buses
  const sortedExisting = [...existingBuses].sort((a, b) => {
    // Parse voltage strings to extract numeric values
    const parseVoltage = (voltage: string): { absValue: number; isNegative: boolean } => {
      const match = voltage.match(/([+-]?)(\d+\.?\d*)/);
      if (match) {
        const sign = match[1] || '+';
        const numValue = parseFloat(match[2]);
        const absValue = Math.abs(numValue);
        const isNegative = sign === '-';
        return { absValue, isNegative };
      }
      return { absValue: Infinity, isNegative: false };
    };

    const aParsed = parseVoltage(a.voltage);
    const bParsed = parseVoltage(b.voltage);

    if (aParsed.absValue !== bParsed.absValue) {
      return aParsed.absValue - bParsed.absValue;
    }

    if (aParsed.isNegative !== bParsed.isNegative) {
      return aParsed.isNegative ? -1 : 1;
    }

    return 0;
  });

  // Combine: sorted existing buses first, then editing bus at bottom
  const allBuses = editingBus ? [...sortedExisting, editingBus] : sortedExisting;

  const handleAddBus = () => {
    const newBus: PowerBus = {
      id: `powerbus-${Date.now()}-${Math.random()}`,
      name: 'New Power Bus',
      voltage: '+0.0',
      color: '#ff0000',
    };
    setPowerBuses(prev => [...prev, newBus]);
    setEditingPowerBusId(newBus.id);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
      return;
    }
    if (dialogPosition) {
      setDragOffset({
        x: e.clientX - dialogPosition.x,
        y: e.clientY - dialogPosition.y,
      });
      setIsDragging(true);
      e.preventDefault();
    }
  };

  return (
    <div
      ref={dialogRef}
      style={{
        position: 'fixed',
        top: dialogPosition ? `${dialogPosition.y}px` : '50%',
        left: dialogPosition ? `${dialogPosition.x}px` : '50%',
        transform: dialogPosition ? 'none' : 'translate(-50%, -50%)',
        background: '#fff',
        border: '1px solid #0b5fff',
        borderRadius: 4,
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '280px',
        maxWidth: '320px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Fixed header - matches Component Properties style */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px',
          borderBottom: '1px solid #e0e0e0',
          background: '#888',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Manage Power Buses</h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            color: '#fff',
            padding: 0,
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px 20px 6px 6px',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}>
        {allBuses.map((bus) => {
          // Always get the current bus from powerBuses array to ensure we have the latest values
          const currentBus = powerBuses.find(b => b.id === bus.id) || bus;
          // Find the original index for state updates
          const originalIndex = powerBuses.findIndex(b => b.id === bus.id);
          // Check for duplicate names within Power Buses only (excluding current bus)
          const nameIsDuplicate = powerBuses.some(pb => pb.name === currentBus.name && pb.id !== bus.id);
          // Check for duplicate values within Power Buses only (excluding current bus)
          const valueIsDuplicate = powerBuses.some(pb => pb.voltage === currentBus.voltage && pb.id !== bus.id);

          return (
            <div key={bus.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', marginBottom: '4px', background: '#f9f9f9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '50px', flexShrink: 0 }}>
                      Name:
                    </label>
                    <input
                      type="text"
                      value={currentBus.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        // Check for duplicate names (excluding current bus)
                        const isDuplicate = powerBuses.some(pb => pb.name === newName && pb.id !== bus.id);
                        if (!isDuplicate) {
                          const updated = [...powerBuses];
                          if (originalIndex >= 0) {
                            updated[originalIndex] = { ...currentBus, name: newName };
                            setPowerBuses(updated);
                          }
                        }
                      }}
                      placeholder="e.g., +5VDC"
                      style={{ flex: 1, padding: '2px 3px', border: nameIsDuplicate ? '1px solid #ff0000' : '1px solid #ddd', borderRadius: 2, fontSize: '10px', background: '#f5f5f5', color: '#000' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '50px', flexShrink: 0 }}>
                      Value:
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currentBus.voltage}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue === '' || /^[+-]?\d*\.?\d*$/.test(inputValue)) {
                          const updated = [...powerBuses];
                          if (originalIndex >= 0) {
                            updated[originalIndex] = { ...currentBus, voltage: inputValue };
                            setPowerBuses(updated);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputValue = e.target.value.trim();
                        if (inputValue === '') {
                          return;
                        }
                        const numericValue = parseFloat(inputValue);
                        if (!isNaN(numericValue)) {
                          const sign = numericValue >= 0 ? '+' : '-';
                          const absValue = Math.abs(numericValue);
                          const formatted = `${sign}${absValue.toFixed(1).replace(/\.?0+$/, '')}`;
                          const updated = [...powerBuses];
                          if (originalIndex >= 0) {
                            updated[originalIndex] = { ...currentBus, voltage: formatted };
                            setPowerBuses(updated);
                          }
                        }
                      }}
                      placeholder="e.g., +5.0"
                      style={{ flex: 1, padding: '2px 3px', border: valueIsDuplicate ? '1px solid #ff0000' : '1px solid #ddd', borderRadius: 2, fontSize: '10px', background: '#f5f5f5', color: '#000' }}
                    />
                  </div>
                </div>
                <input
                  type="color"
                  value={currentBus.color}
                  onChange={(e) => {
                    const updated = [...powerBuses];
                    if (originalIndex >= 0) {
                      updated[originalIndex] = { ...currentBus, color: e.target.value };
                      setPowerBuses(updated);
                    }
                  }}
                  style={{ width: '24px', height: '24px', border: '1px solid #ccc', borderRadius: 2, cursor: 'pointer', flexShrink: 0 }}
                  title="Color"
                />
                <button
                  onClick={() => {
                    const nodesUsingBus = powers.filter(p => p.powerBusId === bus.id);
                    if (nodesUsingBus.length > 0) {
                      alert(`Cannot delete: ${nodesUsingBus.length} power node(s) are using this bus. Remove or reassign them first.`);
                      return;
                    }
                    setPowerBuses(prev => prev.filter(b => b.id !== bus.id));
                  }}
                  style={{ padding: '2px 6px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 2, cursor: 'pointer', fontSize: '9px', flexShrink: 0 }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer buttons */}
      <div style={{ padding: '6px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={handleAddBus}
          style={{ flex: 1, padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 2, cursor: 'pointer', fontSize: '10px' }}
        >
          + Add Power Bus
        </button>
        <button
          onClick={onClose}
          style={{ flex: 1, padding: '4px 8px', background: '#0b5fff', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: '10px', fontWeight: 500 }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
