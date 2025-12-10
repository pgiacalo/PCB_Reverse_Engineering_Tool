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

import React, { useState } from 'react';

const COMMON_VOLTAGES = [
  '+5V',
  '+3.3V',
  '+12V',
  '+15V',
  '-5V',
  '-12V',
  '-15V',
  'GND',
];

interface VoltageDialogProps {
  isOpen: boolean;
  onSelect: (voltage: string) => void;
  onCancel: () => void;
}

export const VoltageDialog: React.FC<VoltageDialogProps> = ({
  isOpen,
  onSelect,
  onCancel,
}) => {
  const [customVoltage, setCustomVoltage] = useState('');

  if (!isOpen) return null;

  const handleCommonVoltageClick = (voltage: string) => {
    onSelect(voltage);
    setCustomVoltage('');
  };

  const handleCustomSubmit = () => {
    if (customVoltage.trim()) {
      onSelect(customVoltage.trim());
      setCustomVoltage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="voltage-dialog-overlay" onClick={onCancel}>
      <div className="voltage-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="voltage-dialog-title">Select Power Node Voltage</h3>
        
        <div className="voltage-dialog-content">
          <label className="voltage-section-label">Common Voltages:</label>
          <div className="common-voltages">
            {COMMON_VOLTAGES.map((voltage) => (
              <button
                key={voltage}
                className="voltage-button"
                onClick={() => handleCommonVoltageClick(voltage)}
              >
                {voltage}
              </button>
            ))}
          </div>

          <label className="voltage-section-label">Custom Voltage:</label>
          <input
            type="text"
            className="custom-voltage-input"
            placeholder="e.g., +24V, -9V"
            value={customVoltage}
            onChange={(e) => setCustomVoltage(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div className="voltage-dialog-actions">
          <button
            className="voltage-dialog-button voltage-dialog-ok"
            onClick={handleCustomSubmit}
            disabled={!customVoltage.trim()}
          >
            OK
          </button>
          <button
            className="voltage-dialog-button voltage-dialog-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

