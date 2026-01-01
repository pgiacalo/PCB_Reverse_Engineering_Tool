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

import React from 'react';

interface SizePreset {
  label: string;
  value: number;
}

const PRESETS: SizePreset[] = [
  { label: 'S', value: 2 },
  { label: 'M', value: 6 },
  { label: 'L', value: 12 },
  { label: 'XL', value: 24 },
];

interface SizePresetsProps {
  currentSize: number;
  onSizeSelect: (size: number) => void;
  color: string;
}

export const SizePresets: React.FC<SizePresetsProps> = ({
  currentSize,
  onSizeSelect,
  color,
}) => {
  return (
    <div className="size-presets">
      <label className="size-presets-label">Quick Sizes:</label>
      <div className="preset-buttons">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={`preset-button ${currentSize === preset.value ? 'active' : ''}`}
            onClick={() => onSizeSelect(preset.value)}
            title={`${preset.label}: ${preset.value}px`}
            style={
              currentSize === preset.value
                ? { borderColor: color, color: color }
                : undefined
            }
          >
            <span className="preset-label">{preset.label}</span>
            <span className="preset-value">{preset.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

