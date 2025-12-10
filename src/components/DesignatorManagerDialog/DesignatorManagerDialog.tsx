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

import React from 'react';

export interface DesignatorManagerDialogProps {
  visible: boolean;
  onClose: () => void;
  autoAssignDesignators: boolean;
  setAutoAssignDesignators: React.Dispatch<React.SetStateAction<boolean>>;
  useGlobalDesignatorCounters: boolean;
  setUseGlobalDesignatorCounters: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DesignatorManagerDialog: React.FC<DesignatorManagerDialogProps> = ({
  visible,
  onClose,
  autoAssignDesignators,
  setAutoAssignDesignators,
  useGlobalDesignatorCounters,
  setUseGlobalDesignatorCounters,
}) => {
  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '16px', zIndex: 1000, minWidth: '300px', maxWidth: '400px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#222' }}>Manage Designators</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#333', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={autoAssignDesignators}
            onChange={(e) => {
              setAutoAssignDesignators(e.target.checked);
            }}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>Automatically assign designators</span>
        </label>
        <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: 4, fontSize: '11px', color: '#666', lineHeight: '1.4', marginBottom: '12px' }}>
          {autoAssignDesignators ? (
            <div>
              When enabled, new components automatically receive sequential designators (e.g., C1, C2, C3 for Capacitors; R1, R2, R3 for Resistors).
            </div>
          ) : (
            <div>
              When disabled, you must manually assign designators to each component. The designator field will be empty when components are created.
            </div>
          )}
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#333' }}>
          <input
            type="checkbox"
            checked={useGlobalDesignatorCounters}
            onChange={(e) => {
              setUseGlobalDesignatorCounters(e.target.checked);
            }}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>Use global designator counters</span>
        </label>
        <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: 4, fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
          {useGlobalDesignatorCounters ? (
            <div>
              When ON, designators continue from global counters across all projects. New components start with the next value from the global counter (e.g., if global counter is C10, new capacitor will be C11).
            </div>
          ) : (
            <div>
              When OFF (default), designators start at 1 for each project. Each project maintains its own independent designator sequence (e.g., C1, C2, C3...).
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ width: '100%', padding: '6px 12px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '12px' }}
      >
        Close
      </button>
    </div>
  );
};

