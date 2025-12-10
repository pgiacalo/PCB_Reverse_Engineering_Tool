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

