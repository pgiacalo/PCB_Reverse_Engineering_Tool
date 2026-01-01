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
import { MIN_BRUSH_SIZE, MAX_BRUSH_SIZE } from '../../constants';

interface BrushSizeSliderProps {
  value: number;
  onChange: (value: number) => void;
  color: string;
}

export const BrushSizeSlider: React.FC<BrushSizeSliderProps> = ({
  value,
  onChange,
  color,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const percentage = ((value - MIN_BRUSH_SIZE) / (MAX_BRUSH_SIZE - MIN_BRUSH_SIZE)) * 100;

  return (
    <div className="brush-size-slider">
      <label className="brush-size-label">
        Brush Size:
      </label>
      <div className="slider-container">
        <input
          type="range"
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          value={value}
          onChange={handleChange}
          className="slider"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, rgba(255, 255, 255, 0.2) ${percentage}%, rgba(255, 255, 255, 0.2) 100%)`
          }}
          aria-label="Brush size"
        />
        <span className="brush-size-value">{value}px</span>
      </div>
    </div>
  );
};

