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

