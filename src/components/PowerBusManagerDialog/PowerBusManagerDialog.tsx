import React from 'react';

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
  if (!visible) return null;

  // Separate buses into existing (sorted) and editing (at bottom)
  const existingBuses = powerBuses.filter(b => b.id !== editingPowerBusId);
  const editingBus = powerBuses.find(b => b.id === editingPowerBusId);

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

  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px', zIndex: 1000, minWidth: '280px', maxWidth: '320px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#222' }}>Manage Power Buses</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ marginBottom: '12px' }}>
        {allBuses.map((bus) => {
          // Find the original index for state updates
          const originalIndex = powerBuses.findIndex(b => b.id === bus.id);
          // Check for duplicate names within Power Buses only (excluding current bus)
          const nameIsDuplicate = powerBuses.some(pb => pb.name === bus.name && pb.id !== bus.id);
          // Check for duplicate values within Power Buses only (excluding current bus)
          const valueIsDuplicate = powerBuses.some(pb => pb.voltage === bus.voltage && pb.id !== bus.id);
          
          return (
            <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', marginBottom: '4px', background: '#f9f9f9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: bus.color, border: '1px solid #ccc', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#666', width: '40px', flexShrink: 0 }}>Name</div>
                  <input
                    type="text"
                    value={bus.name}
                    onChange={(e) => {
                      const updated = [...powerBuses];
                      updated[originalIndex] = { ...bus, name: e.target.value };
                      setPowerBuses(updated);
                    }}
                    onFocus={() => {
                      setEditingPowerBusId(bus.id);
                    }}
                    placeholder="e.g., +3V3, -3V3"
                    style={{ flex: 1, padding: '2px 4px', border: nameIsDuplicate ? '1px solid #ff0000' : '1px solid #ccc', borderRadius: 3, fontSize: '11px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#666', width: '40px', flexShrink: 0 }}>Value</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bus.voltage}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '' || /^[+-]?\d*\.?\d*$/.test(inputValue)) {
                        const updated = [...powerBuses];
                        updated[originalIndex] = { ...bus, voltage: inputValue };
                        setPowerBuses(updated);
                      }
                    }}
                    onBlur={(e) => {
                      const inputValue = e.target.value.trim();
                      if (inputValue === '') {
                        if (editingPowerBusId === bus.id) {
                          setEditingPowerBusId(null);
                        }
                        return;
                      }
                      const numericValue = parseFloat(inputValue);
                      if (!isNaN(numericValue)) {
                        const sign = numericValue >= 0 ? '+' : '-';
                        const absValue = Math.abs(numericValue);
                        const formatted = `${sign}${absValue.toFixed(1).replace(/\.?0+$/, '')}`;
                        const updated = [...powerBuses];
                        updated[originalIndex] = { ...bus, voltage: formatted };
                        setPowerBuses(updated);
                        if (editingPowerBusId === bus.id) {
                          setEditingPowerBusId(null);
                        }
                      }
                    }}
                    onFocus={() => {
                      setEditingPowerBusId(bus.id);
                    }}
                    placeholder="e.g., +3.3, -3.3"
                    style={{ flex: 1, padding: '2px 4px', border: valueIsDuplicate ? '1px solid #ff0000' : '1px solid #ccc', borderRadius: 3, fontSize: '11px' }}
                  />
                </div>
              </div>
              <input
                type="color"
                value={bus.color}
                onChange={(e) => {
                  const updated = [...powerBuses];
                  updated[originalIndex] = { ...bus, color: e.target.value };
                  setPowerBuses(updated);
                }}
                style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
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
                style={{ padding: '3px 6px', background: '#e0e0e0', color: '#333', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', fontSize: '10px', flexShrink: 0 }}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={handleAddBus}
        style={{ width: '100%', padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '11px', marginBottom: '6px' }}
      >
        + Add Power Bus
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '11px' }}
      >
        Close
      </button>
    </div>
  );
};

