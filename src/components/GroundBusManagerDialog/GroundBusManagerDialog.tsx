import React from 'react';

export interface GroundBus {
  id: string;
  name: string;
  color: string;
}

export interface GroundBusManagerDialogProps {
  visible: boolean;
  onClose: () => void;
  groundBuses: GroundBus[];
  setGroundBuses: React.Dispatch<React.SetStateAction<GroundBus[]>>;
  editingGroundBusId: string | null;
  setEditingGroundBusId: React.Dispatch<React.SetStateAction<string | null>>;
  grounds: Array<{ id: string; groundBusId?: string }>;
}

export const GroundBusManagerDialog: React.FC<GroundBusManagerDialogProps> = ({
  visible,
  onClose,
  groundBuses,
  setGroundBuses,
  editingGroundBusId,
  setEditingGroundBusId,
  grounds,
}) => {
  if (!visible) return null;

  // Separate buses into existing (sorted) and editing (at bottom)
  const existingBuses = groundBuses.filter(b => b.id !== editingGroundBusId);
  const editingBus = groundBuses.find(b => b.id === editingGroundBusId);

  // Sort existing buses
  const sortedExisting = [...existingBuses].sort((a, b) => a.name.localeCompare(b.name));

  // Combine: sorted existing buses first, then editing bus at bottom
  const allBuses = editingBus ? [...sortedExisting, editingBus] : sortedExisting;

  const handleAddBus = () => {
    const newBus: GroundBus = {
      id: `groundbus-${Date.now()}-${Math.random()}`,
      name: 'New Ground Bus',
      color: '#000000',
    };
    setGroundBuses(prev => [...prev, newBus]);
    setEditingGroundBusId(newBus.id);
  };

  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px', zIndex: 1000, minWidth: '280px', maxWidth: '320px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#222' }}>Manage Ground Buses</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ marginBottom: '12px' }}>
        {allBuses.map((bus) => {
          // Find the original index for state updates
          const originalIndex = groundBuses.findIndex(b => b.id === bus.id);
          // Check for duplicate names within Ground Buses only (excluding current bus)
          const nameIsDuplicate = groundBuses.some(gb => gb.name === bus.name && gb.id !== bus.id);
          
          return (
            <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', marginBottom: '4px', background: '#f9f9f9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: bus.color, border: '1px solid #ccc', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#666', width: '40px', flexShrink: 0 }}>Name</div>
                  <input
                    type="text"
                    value={bus.name}
                    onChange={(e) => {
                      const updated = [...groundBuses];
                      updated[originalIndex] = { ...bus, name: e.target.value };
                      setGroundBuses(updated);
                    }}
                    onFocus={() => {
                      setEditingGroundBusId(bus.id);
                    }}
                    onBlur={() => {
                      if (editingGroundBusId === bus.id) {
                        setEditingGroundBusId(null);
                      }
                    }}
                    placeholder="e.g., GND, Earth"
                    style={{ flex: 1, padding: '2px 4px', border: nameIsDuplicate ? '1px solid #ff0000' : '1px solid #ccc', borderRadius: 3, fontSize: '11px' }}
                  />
                </div>
              </div>
              <input
                type="color"
                value={bus.color}
                onChange={(e) => {
                  const updated = [...groundBuses];
                  updated[originalIndex] = { ...bus, color: e.target.value };
                  setGroundBuses(updated);
                }}
                style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
              />
              <button
                onClick={() => {
                  const nodesUsingBus = grounds.filter(g => g.groundBusId === bus.id);
                  if (nodesUsingBus.length > 0) {
                    alert(`Cannot delete: ${nodesUsingBus.length} ground node(s) are using this bus. Remove or reassign them first.`);
                    return;
                  }
                  setGroundBuses(prev => prev.filter(b => b.id !== bus.id));
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
        + Add Ground Bus
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

