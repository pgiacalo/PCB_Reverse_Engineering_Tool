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
import type { Tool } from '../../types';

interface ToolButtonProps {
  tool: Tool;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  tooltip: string;
  isActive: boolean;
  onClick: () => void;
  color?: string; // For color-reflective tools (via, trace, component, power, ground)
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  label,
  shortcut,
  tooltip,
  isActive,
  onClick,
  color,
}) => {
  return (
    <button
      className={`tool-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={`${tooltip} (${shortcut})`}
      aria-label={`${label} - ${shortcut}`}
      style={color ? { '--tool-color': color } as React.CSSProperties : undefined}
    >
      <div className="tool-icon" style={color ? { color } : undefined}>
        {icon}
      </div>
      <div className="tool-label">
        {label} <span className="tool-shortcut">({shortcut})</span>
      </div>
    </button>
  );
};

