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

